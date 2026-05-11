"""Simple autonomous drive: travel(goalX, goalY) -> int (0 = success)."""

import asyncio
import logging
import math
from typing import List, Optional, Tuple

import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client

logger = logging.getLogger(__name__)


# ─── Tunables ─────────────────────────────────────────────────────────────────

# Goal / completion
ARRIVAL_THRESHOLD_M = 10.0  # within this distance => success
TRAVEL_TIMEOUT_S = 600.0  # absolute time bail-out

# Speed / throttle (throttle range ±100, speed in m/s)
MAX_SPEED = 5.0  # hard cap; brake if exceeded
THROTTLE_NORMAL = 30  # straight-line cruise
THROTTLE_SLOW = 30  # tight turns / near obstacles
THROTTLE_BOOST = 45  # used when stuck — crater climb-out
THROTTLE_REVERSE = -30  # back-out throttle

# Steering (range ±1; sign flips left/right if convention is reversed)
STEERING_GAIN_DEG = 20.0  # heading-error (deg) that maps to full lock (lower = more aggressive)
STEERING_SIGN = 1.0  # set to -1.0 if turn direction is inverted
AVOID_STEER = 0.8  # lateral push when boulder blocks the front
SIDE_BIAS_MARGIN_CM = 50.0  # clearance delta needed to pick a side
CRATER_BIAS_WEIGHT = 0.3  # how strongly a detected crater nudges steering (0..1)
                          # priority: boulders override, heading dominates, craters nudge

# Forced reorient — kicks in when heading is wildly off so we don't just
# crawl in the wrong direction with a small steering value.
REORIENT_ERROR_DEG = 60.0  # |heading error| above this -> full-lock hold
REORIENT_HOLD_S = 2.0      # sustain full-lock steering for this long
REORIENT_THROTTLE = 20     # forward throttle during the hold (low = tight arc)

# Lidar preprocessing
LIDAR_NO_HIT = 9999.0  # value used in place of raw -1 (no detection)

# Front-blockage thresholds
FRONT_OBSTACLE_CM = 300.0  # sensor 2 reading below this = blocked
GROUND_OBSTACLE_MAX_CM = 350.0  # sensors 5/6 below this = obstacle ahead
GROUND_CRATER_MIN_CM = 550.0  # sensors 5/6 above this (and < NO_HIT) = crater

# Loop pacing — pause + brake-pulse after every command so TSS state catches up
COMMAND_PAUSE_S = 0.6
BRAKE_PULSE_S = 0.4
TELEMETRY_FRESH_WAIT_S = 0.4

# Stuck detection / recovery
STUCK_DIST_M = 1.0
STUCK_WINDOW_S = 8.0
MAX_RECOVERY_ATTEMPTS = 4
REVERSE_DURATION_S = 5.0
REORIENT_DURATION_S = 2.5

# Sensor groupings
FRONT_SENSORS = (2, 5, 6)
LEFT_SENSORS = (3, 4, 14, 16)
RIGHT_SENSORS = (0, 1, 13, 15)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _clean(value: float) -> float:
    return LIDAR_NO_HIT if value is None or value < 0 else value


def _preprocess_lidar(lidar: List[float]) -> List[float]:
    return [_clean(v) for v in lidar]


def _bound(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _bearing_to(goalX: float, goalY: float, posX: float, posY: float) -> float:
    # Heading convention: 0° = +Y, 90° = +X (CW from +Y).
    # atan2(dx, dy) returns the bearing in that frame, range [-180, 180].
    return math.degrees(math.atan2(goalX - posX, goalY - posY))


def _distance_to(goalX: float, goalY: float, posX: float, posY: float) -> float:
    return math.hypot(goalX - posX, goalY - posY)


def _heading_error(target_deg: float, current_deg: float) -> float:
    return (target_deg - current_deg + 180.0) % 360.0 - 180.0


def _boulder_blocked(lidar: List[float]) -> Tuple[bool, str]:
    """Hard obstacles directly in the rover's path — must override heading."""
    s2, s5, s6 = lidar[2], lidar[5], lidar[6]
    if s2 < FRONT_OBSTACLE_CM:
        return True, f"obstacle ahead (s2={s2:.0f})"
    if s5 < GROUND_OBSTACLE_MAX_CM or s6 < GROUND_OBSTACLE_MAX_CM:
        return True, f"ground obstacle (s5={s5:.0f}, s6={s6:.0f})"
    return False, ""


def _crater_ahead(lidar: List[float]) -> Tuple[bool, str]:
    """Drop-offs in front — soft hazard, only nudges heading."""
    s5, s6 = lidar[5], lidar[6]
    if GROUND_CRATER_MIN_CM < s5 < LIDAR_NO_HIT:
        return True, f"crater (s5={s5:.0f})"
    if GROUND_CRATER_MIN_CM < s6 < LIDAR_NO_HIT:
        return True, f"crater (s6={s6:.0f})"
    return False, ""


def _side_clearance(lidar: List[float], indices: Tuple[int, ...]) -> float:
    return min(lidar[i] for i in indices)


def _choose_avoidance_steering(lidar: List[float]) -> float:
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    if left > right + SIDE_BIAS_MARGIN_CM:
        return AVOID_STEER * STEERING_SIGN
    if right > left + SIDE_BIAS_MARGIN_CM:
        return -AVOID_STEER * STEERING_SIGN
    return AVOID_STEER * STEERING_SIGN  # tie-break: prefer left


# ─── Low-level command primitives ─────────────────────────────────────────────


async def _send_throttle(v: float) -> None:
    await asyncio.to_thread(tss_client.send_throttle, float(v))


async def _send_steering(v: float) -> None:
    await asyncio.to_thread(tss_client.send_steering, float(v))


async def _send_brakes(v: float) -> None:
    await asyncio.to_thread(tss_client.send_brakes, float(v))


async def _full_stop() -> None:
    await _send_throttle(0.0)
    await _send_steering(0.0)
    await _send_brakes(1.0)


async def _brake_pulse() -> None:
    await _send_brakes(1.0)
    await asyncio.sleep(BRAKE_PULSE_S)
    await _send_brakes(0.0)
    await asyncio.sleep(TELEMETRY_FRESH_WAIT_S)


async def _read_telemetry():
    rover = telemetry_service.rover_data
    if rover is None:
        return None
    snap = await rover.get_snapshot()
    return snap.pr_telemetry if snap else None


# ─── Drive + recovery steps ───────────────────────────────────────────────────


async def _drive_step(tel, goalX: float, goalY: float) -> None:
    lidar = _preprocess_lidar(tel.lidar)
    bearing = _bearing_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
    err = _heading_error(bearing, tel.heading)

    boulder, boulder_why = _boulder_blocked(lidar)
    heading_steer = _bound(STEERING_SIGN * err / STEERING_GAIN_DEG, -1.0, 1.0)

    if boulder:
        # Priority 1: hard obstacle — override heading entirely.
        steering = _choose_avoidance_steering(lidar)
        throttle = THROTTLE_SLOW
        logger.info("BOULDER avoid: %s -> steer=%+.2f", boulder_why, steering)
    else:
        crater, crater_why = _crater_ahead(lidar)
        if crater:
            # Priority 3: crater — heading still leads, small nudge toward
            # the clearer side. Slow down for caution.
            bias = _choose_avoidance_steering(lidar) * CRATER_BIAS_WEIGHT
            steering = _bound(heading_steer + bias, -1.0, 1.0)
            throttle = THROTTLE_SLOW
            logger.info(
                "crater nudge: %s -> steer=%+.2f (heading=%+.2f, bias=%+.2f)",
                crater_why, steering, heading_steer, bias,
            )
        else:
            # Priority 2: pure heading-to-goal.
            steering = heading_steer
            throttle = THROTTLE_SLOW if abs(err) > 30 else THROTTLE_NORMAL

    # Speed cap: keep steering, drop throttle, ride the brake.
    if tel.speed >= MAX_SPEED:
        await _send_steering(steering)
        await _send_throttle(0.0)
        await _send_brakes(1.0)
        return

    await _send_brakes(0.0)
    await _send_steering(steering)
    await _send_throttle(throttle)


async def _recover(tel, goalX: float, goalY: float) -> None:
    """Reverse, then arc forward, like a 3-point turn."""
    logger.warning("recovery: reverse + reorient")

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    bearing = _bearing_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
    err = _heading_error(bearing, tel.heading)
    forward_steer = _bound(STEERING_SIGN * err / STEERING_GAIN_DEG, -1.0, 1.0)
    # In a car-like vehicle reversing with steering swings the rear opposite,
    # which rotates the body toward the desired forward heading.
    reverse_steer = -forward_steer

    await _send_brakes(0.0)
    await _send_steering(reverse_steer)
    await _send_throttle(THROTTLE_REVERSE)
    await asyncio.sleep(REVERSE_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_brakes(0.0)
    await _send_steering(forward_steer)
    await _send_throttle(THROTTLE_SLOW)
    await asyncio.sleep(REORIENT_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


# ─── Public entry point ───────────────────────────────────────────────────────


async def travel(goalX: float, goalY: float) -> int:
    """Drive the rover within ARRIVAL_THRESHOLD_M of (goalX, goalY).

    Returns 0 on success, 1 on failure (timeout / stuck-out).
    """
    loop = asyncio.get_event_loop()
    started = loop.time()

    stuck_anchor: Optional[Tuple[float, float]] = None
    stuck_anchor_t: float = 0.0
    recoveries = 0

    try:
        while True:
            if loop.time() - started > TRAVEL_TIMEOUT_S:
                logger.error("travel: timeout")
                await _full_stop()
                return 1

            tel = await _read_telemetry()
            if tel is None:
                await asyncio.sleep(TELEMETRY_FRESH_WAIT_S)
                continue

            dist = _distance_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
            logger.info(
                "pos=(%.1f,%.1f) hdg=%.1f spd=%.2f dist=%.1f",
                tel.rover_pos_x,
                tel.rover_pos_y,
                tel.heading,
                tel.speed,
                dist,
            )

            if dist <= ARRIVAL_THRESHOLD_M:
                await _full_stop()
                logger.info("travel: arrived (dist=%.1fm)", dist)
                return 0

            # Stuck detection over a rolling window.
            now = loop.time()
            if stuck_anchor is None:
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now
            elif now - stuck_anchor_t >= STUCK_WINDOW_S:
                moved = math.hypot(
                    tel.rover_pos_x - stuck_anchor[0],
                    tel.rover_pos_y - stuck_anchor[1],
                )
                if moved < STUCK_DIST_M:
                    recoveries += 1
                    logger.warning(
                        "stuck: moved %.2fm in %.1fs (recovery %d/%d)",
                        moved,
                        now - stuck_anchor_t,
                        recoveries,
                        MAX_RECOVERY_ATTEMPTS,
                    )
                    if recoveries > MAX_RECOVERY_ATTEMPTS:
                        await _full_stop()
                        logger.error("travel: recovery attempts exhausted")
                        return 1
                    await _recover(tel, goalX, goalY)
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now

            await _drive_step(tel, goalX, goalY)
            await asyncio.sleep(COMMAND_PAUSE_S)
            await _brake_pulse()
    except asyncio.CancelledError:
        await _full_stop()
        raise
