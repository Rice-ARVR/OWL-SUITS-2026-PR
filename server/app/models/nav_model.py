import asyncio
from datetime import datetime
from enum import Enum
from typing import AsyncGenerator, List, Literal, Optional

from pydantic import BaseModel, Field

# --- Enums ---


class SearchPhase(Enum):
    IDLE = "idle"
    TRANSIT_TO_LNP = "transit_to_lnp"
    CONCENTRIC_SEARCH = "concentric_search"
    GRADIENT_ASCENT = "gradient_ascent"
    TIGHT_SPIRAL = "tight_spiral"
    FOUND = "found"


class DistanceCategory(Enum):
    NOT_IN_RANGE = "not_in_range"  # > 0 dBm → Not a valid RSSI, indicates no signal
    STRONG = "strong"  # 0 to -30 dBm → 0-100m
    MODERATE = "moderate"  # -30 to -67 dBm → 100-462m
    WEAK = "weak"  # -67 to -80 dBm → 462-1200m
    VERY_WEAK = "very_weak"  # -80 to -90 dBm → 1200+m


# --- Data Models ---


class Position(BaseModel):
    x: float
    y: float
    heading: Optional[float] = None


class RssiSignalStrength(BaseModel):
    value: float
    category: DistanceCategory
    distance_min: float
    distance_max: float
    timestamp: datetime


class PingRecord(BaseModel):
    timestamp: datetime
    rssi: float
    rover_position: Position
    signal_category: DistanceCategory


class SearchArea(BaseModel):
    """Represents the estimated annulus (donut) area where the LTV is located."""

    center: Position
    radius_min_m: float
    radius_max_m: float


class LidarReading(BaseModel):
    index: int
    distance_cm: float
    is_obstacle: bool


class LidarScan(BaseModel):
    readings: List[LidarReading]
    clear_ahead: bool
    closest_obstacle_distance: float


class NavigationTarget(BaseModel):
    position: Position
    description: str
    arrival_threshold_m: float


class SearchSession(BaseModel):
    session_id: str
    lnp: Position
    search_center: Position
    phase: SearchPhase

    # memory flag
    previous_phase: Optional[SearchPhase] = None

    success_vector: float
    ping_history: List[PingRecord]

    # Arrays for the frontend map UI
    path_history: List[Position] = []
    projected_path: List[Position] = []

    best_rssi: float
    current_target: Optional[NavigationTarget] = None

    # Track local minimum sweeps during Gradient Ascent
    gradient_retries: int = 0

    # Expose the estimated search zone to the UI
    search_area: Optional[SearchArea] = None


class Hazard(BaseModel):
    """
    Represents a dynamically mapped hazard on the lunar surface.
    Defined by a polygonal boundary of ordered coordinate points.
    """

    id: str
    description: Optional[str] = "Polygonal Hazard"
    # Field(min_length=3) enforces that the array must contain at least a triangle
    points: List[Position] = Field(
        ...,
        min_length=3,
        description="Ordered list of boundary points making up the hazard polygon.",
    )


class NavigationState(BaseModel):
    session: Optional[SearchSession] = None
    latest_rssi: Optional[RssiSignalStrength] = None
    latest_lidar: Optional[LidarScan] = None
    rover_position: Optional[Position] = None
    autonomous_driving: bool = False

    hazards: List[Hazard] = []
    projected_path: List[Position] = []

    # UI flags for driver handoff
    status_message: str = "System Idle. Manual Control Active."
    status_level: Literal["info", "warning", "critical", "success"] = "info"


# --- Frontend Exclusions ---
FRONTEND_EXCLUDES = {
    "session": {
        "lnp": True,
        "previous_phase": True,
        "success_vector": True,
        "best_rssi": True,
        "gradient_retries": True,
    },
    "latest_lidar": True,
    "rover_position": True,
}


# --- Thread-Safe Wrapper ---


class NavigationStateData:
    def __init__(self) -> None:
        self._data: NavigationState = NavigationState()
        # An asyncio.Condition inherently acts as a lock AND an event notifier
        self._condition: asyncio.Condition = asyncio.Condition()

    async def update_hazards(self, hazards: List[Hazard]) -> None:
        async with self._condition:
            self._data.hazards = hazards
            self._condition.notify_all()  # Wakes up the SSE stream

    async def update_session(self, session: SearchSession) -> None:
        async with self._condition:
            self._data.session = session
            self._condition.notify_all()

    async def update_rssi(self, rssi: RssiSignalStrength) -> None:
        async with self._condition:
            self._data.latest_rssi = rssi
            self._condition.notify_all()

    async def update_lidar(self, lidar: LidarScan) -> None:
        async with self._condition:
            self._data.latest_lidar = lidar
            self._condition.notify_all()

    async def update_rover_position(self, position: Position) -> None:
        async with self._condition:
            self._data.rover_position = position
            self._condition.notify_all()

    async def set_autonomous_driving(self, enabled: bool) -> None:
        async with self._condition:
            self._data.autonomous_driving = enabled
            self._condition.notify_all()

    # push UI alerts
    async def update_status(
        self,
        message: str,
        level: Literal["info", "warning", "critical", "success"] = "info",
    ) -> None:
        async with self._condition:
            self._data.status_message = message
            self._data.status_level = level
            self._condition.notify_all()

    async def get_snapshot(self) -> NavigationState:
        """Used internally by the backend (includes all data)."""
        async with self._condition:
            return self._data

    async def subscribe_frontend(self) -> AsyncGenerator[str, None]:
        """Async generator strictly for the SSE stream. Yields filtered JSON only on changes."""
        async with self._condition:
            # 1. Send the initial state immediately upon connection
            yield self._data.model_dump_json(exclude=FRONTEND_EXCLUDES)

            # 2. Go to sleep. Only wake up when notify_all() is called by an update
            while True:
                await self._condition.wait()
                yield self._data.model_dump_json(exclude=FRONTEND_EXCLUDES)
