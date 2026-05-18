"""Vision-based autonomous navigation telemetry schema for frontend display.

Captures steering decisions, obstacle detection, and system health metrics
for real-time UI feedback during autonomous drive operations.
"""

from dataclasses import asdict, dataclass
from typing import List, Optional, Tuple


@dataclass
class Detection:
    """YOLO detection from CV system."""

    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    class_name: str  # 'crater', 'boulder', 'ltv', 'base'


@dataclass
class SteeringComponents:
    """Breakdown of how final steering magnitude was computed."""

    heading_steer: float  # goal-pointing component [-1, 1]
    avoid_steer: float  # obstacle-avoidance component [-1, 1]
    heading_blend_factor: float  # how much goal-heading leaks through during avoidance


@dataclass
class HealthStatus:
    """System health and recovery tracking."""

    boxed_streak: int  # consecutive steps both flanks blocked
    stuck_moved_m: float  # distance moved in stuck detection window
    stuck_threshold_m: float  # minimum distance required to reset stuck counter
    stuck_window_s: float  # rolling window duration for stuck detection
    frame_age_s: float  # how stale the latest CV frame is
    no_frame_timeout_s: float  # timeout threshold for dead feed


@dataclass
class VisionTelemetry:
    """Complete vision-based autonomous navigation telemetry snapshot.

    Emitted once per control loop (~2 Hz) and streamed to frontend via WebSocket.
    """

    # Metadata
    timestamp: float  # loop.time() when snapshot was created
    sequence_number: int  # incrementing counter per snapshot

    # State
    mode: str  # 'AVOID' | 'CLEAR' | 'BOXED'
    active: bool  # whether travel_vision() is currently running

    # Position & motion
    position_x: float  # rover X coordinate (meters)
    position_y: float  # rover Y coordinate (meters)
    heading: float  # rover heading (0°=+Y, 90°=+X)
    speed: float  # rover speed (m/s)
    distance_to_goal: float  # Euclidean distance to target (meters)

    # Vision data
    detections: List[Detection]  # YOLO detections in frame
    column_danger: List[float]  # 12-column danger accumulation [0..1.0]
    total_danger: float  # sum of weighted column dangers
    center_blocked: bool  # center 4 columns have danger

    # Steering composition
    steering_components: SteeringComponents
    final_steering: float  # command sent to rover [-1, 1]
    final_throttle: float  # command sent to rover [0, 100]

    # Health
    health: HealthStatus

    # Recovery codes
    return_code: Optional[int] = None  # set at end: 0=success, 1=fail, 2=interrupt

    def to_dict(self) -> dict:
        """Serialize to JSON-compatible dict, expanding nested dataclasses."""
        data = asdict(self)
        # Expand detections list of dataclasses
        data["detections"] = [asdict(d) for d in self.detections]
        # Expand nested dataclasses
        data["steering_components"] = asdict(self.steering_components)
        data["health"] = asdict(self.health)
        return data
