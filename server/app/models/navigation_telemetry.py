"""Vision-based autonomous navigation telemetry schema for frontend display.

Captures steering decisions, obstacle detection, and system health metrics
for real-time UI feedback during autonomous drive operations.
"""

from dataclasses import dataclass
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

    Emitted once per control loop (~2 Hz) and streams ONLY formatted UI
    strings to the frontend via WebSocket.
    """

    # Metadata
    timestamp: float
    sequence_number: int

    # State
    mode: str  # 'AVOID' | 'CLEAR' | 'BOXED'
    active: bool

    # Position & motion
    position_x: float
    position_y: float
    heading: float
    speed: float
    distance_to_goal: float

    # Vision data
    detections: List[Detection]
    column_danger: List[float]
    total_danger: float
    center_blocked: bool

    # Steering composition
    steering_components: SteeringComponents
    final_steering: float
    final_throttle: float

    # Health
    health: HealthStatus

    # Recovery codes
    return_code: Optional[int] = None

    def get_ui_messages(self) -> dict:
        """Translates raw telemetry into human-readable UI strings for the frontend."""
        ui = {}

        # 1. Active Drive Mode
        if self.mode == "CLEAR":
            ui["mode"] = "🟢 Mode: CLEAR (Direct Pathing)"
        elif self.mode == "AVOID":
            ui["mode"] = "🟡 Mode: AVOID (Evasive Maneuver)"
        elif self.mode == "BOXED":
            ui["mode"] = "🔴 Mode: BOXED (Evaluating Escape)"
        else:
            ui["mode"] = f"⚪ Mode: {self.mode}"

        # 2. Threat Assessment
        if self.center_blocked:
            threats = ", ".join(list(set(d.class_name for d in self.detections)))
            ui["threat"] = (
                f"Path: Center Blocked by [{threats}] (Danger Score: {self.total_danger:.2f})"
            )
        elif self.total_danger > 0.1:
            ui["threat"] = (
                f"Path: Flank Obstacle Detected (Danger Score: {self.total_danger:.2f})"
            )
        else:
            ui["threat"] = "Path: Clear"

        # 3. Steering Breakdown
        avoid = self.steering_components.avoid_steer
        head = self.steering_components.heading_steer
        if self.mode == "AVOID":
            ui["steering"] = (
                f"Steering: {self.final_steering:+.2f} (Evasion: {avoid:+.2f} | Goal: {head:+.2f})"
            )
        else:
            ui["steering"] = (
                f"Steering: {self.final_steering:+.2f} (Pure Goal Heading: {head:+.2f})"
            )

        # 4. Throttle & Pacing
        if self.final_throttle >= 80:
            ui["throttle"] = f"Throttle: NORMAL ({self.final_throttle}%)"
        elif self.final_throttle > 0:
            ui["throttle"] = (
                f"Throttle: SLOW ({self.final_throttle}%) - Correction Maneuver"
            )
        else:
            ui["throttle"] = "Throttle: STOPPED"

        # 5. AI Health & Frustration
        health_msgs = []
        if self.health.boxed_streak > 0:
            health_msgs.append(f"⚠️ Boxed-In Streak: {self.health.boxed_streak} steps")
        if self.health.stuck_moved_m < self.health.stuck_threshold_m and self.active:
            health_msgs.append(
                f"⚠️ Stuck Warning: Low movement ({self.health.stuck_moved_m:.2f}m)"
            )
        if self.health.frame_age_s > 1.5:
            health_msgs.append(
                f"⚠️ Vision Feed Lag: Frame is {self.health.frame_age_s:.1f}s old"
            )

        ui["health"] = " | ".join(health_msgs) if health_msgs else "Status: Nominal"

        return ui

    def to_dict(self) -> dict:
        """Serialize ONLY the frontend UI strings. We no longer send raw telemetry."""
        return self.get_ui_messages()
