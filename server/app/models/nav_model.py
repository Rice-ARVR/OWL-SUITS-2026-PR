import asyncio
from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

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
    value: float  # dBm
    category: DistanceCategory
    distance_min: float
    distance_max: float
    timestamp: datetime


class PingRecord(BaseModel):
    timestamp: datetime
    rssi: float
    rover_position: Position
    signal_category: DistanceCategory


class LidarReading(BaseModel):
    index: int  # 0-16
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


# --- Thread-Safe Wrapper ---


class NavigationStateData:
    def __init__(self) -> None:
        self._data: NavigationState = NavigationState()
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update_hazards(self, hazards: List[Hazard]) -> None:
        """Updates the list of polygonal hazards on the map."""
        async with self._lock:
            self._data.hazards = hazards

    async def update_session(self, session: SearchSession) -> None:
        async with self._lock:
            self._data.session = session

    async def update_rssi(self, rssi: RssiSignalStrength) -> None:
        async with self._lock:
            self._data.latest_rssi = rssi

    async def update_lidar(self, lidar: LidarScan) -> None:
        async with self._lock:
            self._data.latest_lidar = lidar

    async def update_rover_position(self, position: Position) -> None:
        async with self._lock:
            self._data.rover_position = position

    async def set_autonomous_driving(self, enabled: bool) -> None:
        async with self._lock:
            self._data.autonomous_driving = enabled

    # push UI alerts
    async def update_status(
        self,
        message: str,
        level: Literal["info", "warning", "critical", "success"] = "info",
    ) -> None:
        """Updates the UI status flags for frontend alerts."""
        async with self._lock:
            self._data.status_message = message
            self._data.status_level = level

    async def get_snapshot(self) -> NavigationState:
        async with self._lock:
            return self._data
