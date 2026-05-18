"""Shared navigation primitives for autonomous drivers.

Geometry, low-level TSS command wrappers, pacing/speed constants, and the
stuck-detection thresholds used by both the lidar driver
(`obstacle_avoidance/auto_drive.py`) and the vision driver
(`vision/auto_drive_vision.py`).

Conventions:
- Steering: positive = right (CW), negative = left (CCW); magnitude in [-1, 1].
- Heading: 0° = +Y, 90° = +X (CW from +Y). `_bearing_to` returns this frame.
- Throttle: ±100 scale (TSS native), not normalized.
- Pacing: throttle is kept low and every command is followed by a pause and a
  brake-pulse so the TSS state catches up — necessary to mask the round-trip
  latency between commands and telemetry.
"""

import asyncio
import logging
import math
from typing import Tuple

import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client

logger = logging.getLogger(__name__)


# ─── Shared tunables ──────────────────────────────────────────────────────────

# Goal / completion thresholds
ARRIVAL_THRESHOLD_M = 5.0
TRAVEL_TIMEOUT_S = 600.0

# Pacing — pause + brake-pulse after every command so TSS state catches up.
COMMAND_PAUSE_S = 0.5
BRAKE_PULSE_S = 0.5
TELEMETRY_FRESH_WAIT_S = 0.5

# Speed / throttle (throttle ±100, speed m/s)
MAX_SPEED = 6.0
THROTTLE_NORMAL = 35
THROTTLE_SLOW = 30
THROTTLE_REVERSE = -30

# Steering
STEERING_GAIN_DEG = 60.0  # Higher = aggressive reorientation to target
STEERING_SIGN = 1.0  # set to -1.0 if the platform inverts turn direction

# Stuck detection / recovery (rolling-window no-progress check)
STUCK_DIST_M = 1.0
STUCK_WINDOW_S = 10.0


# ─── Pure helpers: geometry ───────────────────────────────────────────────────


def _bound(x: float, lo: float, hi: float) -> float:
    """Clamp x to [lo, hi]."""
    return max(lo, min(hi, x))


def _bearing_to(goalX: float, goalY: float, posX: float, posY: float) -> float:
    """Bearing from (posX,posY) to (goalX,goalY) in degrees; 0°=+Y, 90°=+X."""
    return math.degrees(math.atan2(goalX - posX, goalY - posY))


def _distance_to(goalX: float, goalY: float, posX: float, posY: float) -> float:
    """Euclidean distance between (posX,posY) and (goalX,goalY) in meters."""
    return math.hypot(goalX - posX, goalY - posY)


def _heading_error(target_deg: float, current_deg: float) -> float:
    """Signed angle from current to target, normalized to (-180, 180]."""
    return (target_deg - current_deg + 180.0) % 360.0 - 180.0


def _goal_steering(tel, goalX: float, goalY: float) -> Tuple[float, float]:
    """Return (steering, heading_error_deg) for pointing at the goal."""
    bearing = _bearing_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
    err = _heading_error(bearing, tel.heading)
    steer = _bound(STEERING_SIGN * err / STEERING_GAIN_DEG, -1.0, 1.0)
    return steer, err


# ─── Low-level command primitives ─────────────────────────────────────────────


async def _send_throttle(v: float) -> None:
    """Forward throttle command through tss_client."""
    await asyncio.to_thread(tss_client.send_throttle, float(v))


async def _send_steering(v: float) -> None:
    """Forward steering command through tss_client."""
    await asyncio.to_thread(tss_client.send_steering, float(v))


async def _send_brakes(v: float) -> None:
    """Forward brake command through tss_client."""
    await asyncio.to_thread(tss_client.send_brakes, float(v))


async def _send_drive(throttle: float, steering: float, brakes: float = 0.0) -> None:
    """Apply brakes, steering, and throttle."""
    await _send_brakes(brakes)
    await _send_steering(steering)
    await _send_throttle(throttle)


async def _full_stop() -> None:
    """Throttle 0, steering centered, full brake."""
    await _send_throttle(0.0)
    await _send_steering(0.0)
    await _send_brakes(1.0)


async def _brake_pulse() -> None:
    """Briefly engage and release brakes so TSS state catches up to the last command."""
    await _send_brakes(1.0)
    await asyncio.sleep(BRAKE_PULSE_S)
    await _send_brakes(0.0)
    await asyncio.sleep(TELEMETRY_FRESH_WAIT_S)


async def _apply_speed_cap(tel, steering: float) -> bool:
    """If over MAX_SPEED, brake while holding steering. Returns True if applied."""
    if tel.speed < MAX_SPEED:
        return False
    await _send_steering(steering)
    await _send_throttle(0.0)
    await _send_brakes(1.0)
    return True


async def _read_telemetry():
    """Latest rover snapshot's pr_telemetry, or None if unavailable."""
    rover = telemetry_service.rover_data
    if rover is None:
        return None
    snap = await rover.get_snapshot()
    return snap.pr_telemetry if snap else None
