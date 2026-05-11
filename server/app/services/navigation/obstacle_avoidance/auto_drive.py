"""Simple autonomous drive: travel(goalX, goalY) -> int (0 = success)."""

import asyncio
import logging
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client

logger = logging.getLogger(__name__)


# ─── Tunables ─────────────────────────────────────────────────────────────────

# Goal / completion
ARRIVAL_THRESHOLD_M = 5.0  # within this distance => success
TRAVEL_TIMEOUT_S = 600.0  # absolute time bail-out

# Speed / throttle (throttle range ±100, speed in m/s)
MAX_SPEED = 5.0  # hard cap; brake if exceeded
THROTTLE_NORMAL = 30  # straight-line cruise
THROTTLE_SLOW = 30  # tight turns / near obstacles
THROTTLE_BOOST = 45  # used when stuck — crater climb-out
THROTTLE_REVERSE = -30  # back-out throttle

# Steering (range ±1; sign flips left/right if convention is reversed)
STEERING_GAIN_DEG = (
    40.0  # heading-error (deg) that maps to full lock (lower = more aggressive)
)
STEERING_SIGN = 1.0  # set to -1.0 if turn direction is inverted
AVOID_STEER = 0.8  # lateral push when boulder blocks the front
SIDE_BIAS_MARGIN_CM = 50.0  # clearance delta needed to pick a side
CRATER_BIAS_WEIGHT = 0.3  # how strongly a detected crater nudges steering (0..1)
# priority: boulders override, heading dominates, craters nudge

# Forced reorient — kicks in when heading is wildly off so we don't just
# crawl in the wrong direction with a small steering value.
REORIENT_ERROR_DEG = 60.0  # |heading error| above this -> full-lock hold
REORIENT_HOLD_S = 2.0  # sustain full-lock steering for this long
REORIENT_THROTTLE = 20  # forward throttle during the hold (low = tight arc)

# Lidar preprocessing
LIDAR_NO_HIT = 9999.0  # value used in place of raw -1 (no detection)

# Front-blockage thresholds
FRONT_OBSTACLE_CM = 900.0  # sensor 2 reading below this = blocked (tall obstacle)
TALL_OBSTACLE_BRAKE_CM = 600.0  # sensor 2 below this = brake + reverse out
GROUND_OBSTACLE_MAX_CM = 300.0  # sensors 5/6 below this = obstacle ahead
GROUND_CRATER_MIN_CM = 600.0  # sensors 5/6 above this (and < NO_HIT) = crater

# Predictive turning — angled forward sensors (0/15 right, 4/16 left).
# Only activates if at least one of these reads below the limit, so it doesn't
# fight heading-to-goal in open terrain.
PREDICTIVE_AVOID_CM = 900.0
PREDICTIVE_NUDGE_WEIGHT = 0.8  # 0..1; how strongly an angled return pushes steer

# Tall-obstacle reverse maneuver
TALL_REVERSE_DURATION_S = 5.0
TALL_REVERSE_STEER = 1.0  # magnitude of steering during the reverse-out

# Wall following — kicks in for large/persistent obstacles that simple avoidance
# can't get around in one or two steering steps. We pick the clearer side, keep
# the obstacle as a "wall" on the opposite flank, and skim along it until we
# can safely cut back toward the goal.
WALL_FOLLOW_TIMEOUT_S = 120.0  # absolute cap on a single wall-follow episode
WALL_FOLLOW_PERSIST_STEPS = 2  # consecutive boulder-blocked steps before entry
WALL_TRIGGER_WIDE_CM = 800.0  # both side predictive sensors below this => wide wall
WALL_TARGET_CM = 450.0  # desired standoff from the wall
WALL_DEADBAND_CM = 80.0  # |distance error| under this => no correction
WALL_GAIN = 1.0 / 350.0  # steering per cm of distance error (clipped to ±1)
WALL_FRONT_CLEAR_CM = 900.0  # front sensor must read above this to exit
WALL_SIDE_CLEAR_CM = 800.0  # goal-side predictive sensors clear above this to exit
WALL_EXIT_HEADING_DEG = 20.0  # heading error toward goal must be at least this on
#                              the away-from-wall side before we can exit
WALL_FRONT_BLOCKED_STEER = 0.9  # turn hard away when the wall closes in front
WALL_LOST_SIDE_STEER = 0.4  # gentle bend back toward wall when it disappears
WALL_GONE_CM = 950.0  # wall-side lateral + forward both above this => obstacle passed
#                       (max real return is ~1000; above this == effectively no-hit)
WALL_THROTTLE = 30

# Sensor used to *measure* lateral wall distance on each side (most lateral).
WALL_RIGHT_SIDE_SENSOR = 0  # 30°R at right wheel hub
WALL_LEFT_SIDE_SENSOR = 4  # 30°L at left wheel hub

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

# Crater escape — boosted-throttle climb-out when we're stuck inside a pit.
# Bypasses the MAX_SPEED cap (this routine talks to the tss_client directly
# instead of going through _drive_step, so the cap never applies here).
CRATER_ESCAPE_THROTTLE = THROTTLE_BOOST  # full power past the normal cap
CRATER_ESCAPE_DURATION_S = 3.0  # how long to hold the boost
CRATER_ESCAPE_COOLDOWN_S = 15.0  # min time between back-to-back escapes

# Sensor groupings
FRONT_SENSORS = (2, 5, 6)
LEFT_SENSORS = (3, 4, 14, 16)
RIGHT_SENSORS = (0, 1, 13, 15)
# Angled forward pairs used for predictive turning while still moving forward.
FRONT_RIGHT_PREDICT = (0, 15)  # 30°R, 15°R
FRONT_LEFT_PREDICT = (4, 16)  # 30°L, 15°L


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
    """Steer toward the clearer flank. Positive = right turn, so the clearer
    side maps to: left => negative, right => positive."""
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    if left > right + SIDE_BIAS_MARGIN_CM:
        return -AVOID_STEER * STEERING_SIGN
    if right > left + SIDE_BIAS_MARGIN_CM:
        return AVOID_STEER * STEERING_SIGN
    return -AVOID_STEER * STEERING_SIGN  # tie-break: prefer left


def _predictive_steer_bias(lidar: List[float]) -> Tuple[float, str]:
    """Nudge steering toward the clearer angled-front side (right: 0/15,
    left: 4/16). If both sides are clear of the limit, returns 0 so
    heading-to-goal stays in charge. Positive = right turn, so the clearer
    side maps to: left => negative, right => positive.
    """
    right = min(lidar[i] for i in FRONT_RIGHT_PREDICT)
    left = min(lidar[i] for i in FRONT_LEFT_PREDICT)
    if right >= PREDICTIVE_AVOID_CM and left >= PREDICTIVE_AVOID_CM:
        return 0.0, ""
    why = f"predict L={left:.0f} R={right:.0f}"
    if left > right + SIDE_BIAS_MARGIN_CM:
        return -PREDICTIVE_NUDGE_WEIGHT * STEERING_SIGN, why
    if right > left + SIDE_BIAS_MARGIN_CM:
        return PREDICTIVE_NUDGE_WEIGHT * STEERING_SIGN, why
    return -PREDICTIVE_NUDGE_WEIGHT * STEERING_SIGN, why + " (tie-left)"


@dataclass
class _WallFollow:
    """State carried across iterations while wall-following is active."""

    side: str  # 'left' or 'right' — which flank the wall is on
    start_t: float  # loop time when this episode began


def _wide_obstacle(lidar: List[float]) -> bool:
    """True when both forward-angled sides see something close — a wide wall,
    not a single boulder that simple steer-around handles fine."""
    right = min(lidar[i] for i in FRONT_RIGHT_PREDICT)
    left = min(lidar[i] for i in FRONT_LEFT_PREDICT)
    return right < WALL_TRIGGER_WIDE_CM and left < WALL_TRIGGER_WIDE_CM


def _pick_wall_side(lidar: List[float]) -> str:
    """Put the wall on the *less clear* side so the rover skims along it
    while the open side stays available for the eventual escape turn."""
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    # If left is tighter, the wall is on the left; we follow it on our left.
    return "left" if left <= right else "right"


def _wall_distance(lidar: List[float], side: str) -> float:
    return lidar[WALL_LEFT_SIDE_SENSOR if side == "left" else WALL_RIGHT_SIDE_SENSOR]


def _wall_front_predict(lidar: List[float], side: str) -> float:
    """Forward-side return on the wall side — flags an inside corner closing in."""
    indices = FRONT_LEFT_PREDICT if side == "left" else FRONT_RIGHT_PREDICT
    return min(lidar[i] for i in indices)


def _wall_is_gone(lidar: List[float], side: str) -> bool:
    """True when the wall-side sensors no longer see the obstacle — the rover
    has skimmed past it and there's nothing left to follow."""
    lateral = _wall_distance(lidar, side)
    forward = _wall_front_predict(lidar, side)
    return lateral >= WALL_GONE_CM and forward >= WALL_GONE_CM


def _can_exit_wall(
    lidar: List[float], tel, goalX: float, goalY: float, side: str
) -> bool:
    """Exit when either: (a) the obstacle is no longer on our wall side at all,
    or (b) the goal bearing already points to the away-from-wall side and that
    flank is clear (we can peel off cleanly).

    Heading convention: positive heading_error => goal is clockwise (right) of
    current heading. With wall on the left we want err > +threshold; with wall
    on the right we want err < -threshold.
    """
    if lidar[2] < WALL_FRONT_CLEAR_CM:
        return False

    # (a) Obstacle gone — we passed it, exit immediately regardless of heading.
    if _wall_is_gone(lidar, side):
        return True

    # (b) Goal already lies on the open flank.
    bearing = _bearing_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
    err = _heading_error(bearing, tel.heading)
    if side == "left":
        if err < WALL_EXIT_HEADING_DEG:
            return False
        away_clear = min(lidar[i] for i in FRONT_RIGHT_PREDICT) > WALL_SIDE_CLEAR_CM
    else:
        if err > -WALL_EXIT_HEADING_DEG:
            return False
        away_clear = min(lidar[i] for i in FRONT_LEFT_PREDICT) > WALL_SIDE_CLEAR_CM
    return away_clear


def _wall_follow_steering(lidar: List[float], side: str) -> Tuple[float, str]:
    """Proportional control on wall standoff with overrides for blocked front
    and lost wall (gap/corner).

    Sign convention (matches heading_steer): positive = right turn (CW),
    negative = left turn (CCW). So:
      - "Toward the wall on the LEFT"  => steer left  => negative
      - "Toward the wall on the RIGHT" => steer right => positive
      - "Away from" each is the opposite.
    """
    front_side = _wall_front_predict(lidar, side)
    side_dist = _wall_distance(lidar, side)
    toward_sign = -1.0 if side == "left" else 1.0  # sign that steers TOWARD the wall

    # Inside corner: the wall is closing in front on the wall side. Turn hard
    # AWAY from the wall (opposite of toward_sign).
    if front_side < WALL_TRIGGER_WIDE_CM * 0.6 or lidar[2] < FRONT_OBSTACLE_CM:
        steer = -toward_sign * WALL_FRONT_BLOCKED_STEER * STEERING_SIGN
        return steer, f"corner-in front_side={front_side:.0f} s2={lidar[2]:.0f}"

    # Lost the wall (open gap or convex corner) — bend gently TOWARD it so we
    # don't fly off into open space and lose the obstacle reference.
    if side_dist >= LIDAR_NO_HIT - 1:
        steer = toward_sign * WALL_LOST_SIDE_STEER * STEERING_SIGN
        return steer, f"wall lost (side={side_dist:.0f})"

    # Proportional standoff control. err > 0 => too far from wall => steer
    # TOWARD wall; err < 0 => too close => steer AWAY (same formula, sign of
    # err handles it).
    err = side_dist - WALL_TARGET_CM
    if abs(err) < WALL_DEADBAND_CM:
        return 0.0, f"on-line side={side_dist:.0f}"
    steer = _bound(toward_sign * WALL_GAIN * err * STEERING_SIGN, -1.0, 1.0)
    return steer, f"track side={side_dist:.0f} err={err:+.0f}"


async def _wall_follow_step(tel, state: _WallFollow) -> None:
    """One iteration of wall following. Slow throttle + braked pacing comes
    from the main loop, same as the normal drive step."""
    lidar = _preprocess_lidar(tel.lidar)

    # Tall-obstacle override still applies — back out before we ram the wall.
    if lidar[2] < TALL_OBSTACLE_BRAKE_CM:
        await _tall_obstacle_evade(lidar)
        return

    steering, why = _wall_follow_steering(lidar, state.side)
    logger.info("WALL(%s): %s -> steer=%+.2f", state.side, why, steering)

    if tel.speed >= MAX_SPEED:
        await _send_steering(steering)
        await _send_throttle(0.0)
        await _send_brakes(1.0)
        return

    await _send_brakes(0.0)
    await _send_steering(steering)
    await _send_throttle(WALL_THROTTLE)


def _choose_reverse_steering(lidar: List[float]) -> Tuple[float, str]:
    """Pick reverse-steer so the body rotates toward the clearer side.

    Bicycle-model kinematics: reversing + positive steering rotates the body
    CCW (front swings left). So to swing the front toward the clearer side we
    set reverse_steer = -(forward intent toward clearer side).
    """
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    if right > left + SIDE_BIAS_MARGIN_CM:
        # clearer on right -> want front to swing right -> reverse steer left
        return (
            -TALL_REVERSE_STEER * STEERING_SIGN,
            f"clear-right L={left:.0f} R={right:.0f}",
        )
    # clearer on left, or tie (tie-break left): want front to swing left -> reverse steer right
    return TALL_REVERSE_STEER * STEERING_SIGN, f"clear-left L={left:.0f} R={right:.0f}"


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


async def _tall_obstacle_evade(lidar: List[float]) -> None:
    """Brake hard, then reverse briefly with steering picked from clearance."""
    reverse_steer, why = _choose_reverse_steering(lidar)
    logger.warning(
        "TALL OBSTACLE: s2=%.0f -> brake+reverse %s steer=%+.2f",
        lidar[2],
        why,
        reverse_steer,
    )

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_brakes(0.0)
    await _send_steering(reverse_steer)
    await _send_throttle(THROTTLE_REVERSE)
    await asyncio.sleep(TALL_REVERSE_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


async def _drive_step(tel, goalX: float, goalY: float) -> None:
    lidar = _preprocess_lidar(tel.lidar)

    # Priority 0: very close tall obstacle — brake, then reverse out before
    # any further forward command. Returns immediately; main loop iterates
    # with fresh telemetry.
    if lidar[2] < TALL_OBSTACLE_BRAKE_CM:
        await _tall_obstacle_evade(lidar)
        return

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
        predict_bias, predict_why = _predictive_steer_bias(lidar)
        if crater:
            # Priority 2: crater — heading still leads, small nudge toward
            # the clearer side. Slow down for caution. Predictive bias still
            # applies so we can dodge a side-leaning tall obstacle too.
            bias = _choose_avoidance_steering(lidar) * CRATER_BIAS_WEIGHT
            steering = _bound(heading_steer + bias + predict_bias, -1.0, 1.0)
            throttle = THROTTLE_SLOW
            logger.info(
                "crater nudge: %s -> steer=%+.2f (hdg=%+.2f, crater=%+.2f, %s=%+.2f)",
                crater_why,
                steering,
                heading_steer,
                bias,
                predict_why or "predict",
                predict_bias,
            )
        elif predict_bias != 0.0:
            # Priority 3: predictive turn — angled front sensors see something
            # close enough to be worth dodging while still rolling forward.
            steering = _bound(heading_steer + predict_bias, -1.0, 1.0)
            throttle = THROTTLE_SLOW
            logger.info(
                "predictive nudge: %s -> steer=%+.2f (hdg=%+.2f, bias=%+.2f)",
                predict_why,
                steering,
                heading_steer,
                predict_bias,
            )
        else:
            # Priority 4: pure heading-to-goal.
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


def _in_crater(lidar: List[float]) -> bool:
    """True when the rover looks like it's sitting inside a pit. The front
    pitched-down sensors (5/6) over-shoot the rim, and/or the side pitched-
    down sensors (7/8) lose their ground return. Either signal alone is enough
    given we already know the rover is stuck."""
    s5, s6, s7, s8 = lidar[5], lidar[6], lidar[7], lidar[8]
    front_overshoot = (
        GROUND_CRATER_MIN_CM < s5 < LIDAR_NO_HIT
        or GROUND_CRATER_MIN_CM < s6 < LIDAR_NO_HIT
    )
    # 7/8 are pitched 20° down to the sides — on flat ground they always see
    # something. A NO_HIT return means the ground dropped away on that side.
    side_overshoot = s7 >= LIDAR_NO_HIT - 1 or s8 >= LIDAR_NO_HIT - 1
    return front_overshoot or side_overshoot


async def _crater_escape(tel, goalX: float, goalY: float) -> None:
    """Power out of a crater with boosted throttle. Skips the MAX_SPEED clamp
    by driving the rover directly (not via _drive_step) for a short burst,
    aimed at the goal so we don't climb out into open terrain pointed the
    wrong way."""
    bearing = _bearing_to(goalX, goalY, tel.rover_pos_x, tel.rover_pos_y)
    err = _heading_error(bearing, tel.heading)
    steer = _bound(STEERING_SIGN * err / STEERING_GAIN_DEG, -1.0, 1.0)

    logger.warning(
        "CRATER ESCAPE: boost throttle=%d for %.1fs steer=%+.2f (err=%+.1f°)",
        CRATER_ESCAPE_THROTTLE,
        CRATER_ESCAPE_DURATION_S,
        steer,
        err,
    )

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_brakes(0.0)
    await _send_steering(steer)
    await _send_throttle(CRATER_ESCAPE_THROTTLE)
    await asyncio.sleep(CRATER_ESCAPE_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


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

    wall: Optional[_WallFollow] = None
    boulder_streak = 0
    last_crater_escape_t: float = -CRATER_ESCAPE_COOLDOWN_S  # allow immediate first use

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
                "pos=(%.1f,%.1f) hdg=%.1f spd=%.2f dist=%.1f mode=%s",
                tel.rover_pos_x,
                tel.rover_pos_y,
                tel.heading,
                tel.speed,
                dist,
                f"wall-{wall.side}" if wall else "drive",
            )

            if dist <= ARRIVAL_THRESHOLD_M:
                await _full_stop()
                logger.info("travel: arrived (dist=%.1fm)", dist)
                return 0

            lidar_pre = _preprocess_lidar(tel.lidar)
            blocked, _ = _boulder_blocked(lidar_pre)

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
                    # Crater stuck => boosted throttle climb-out (skips cap).
                    # Otherwise => standard reverse+reorient.
                    if (
                        _in_crater(lidar_pre)
                        and now - last_crater_escape_t >= CRATER_ESCAPE_COOLDOWN_S
                    ):
                        await _crater_escape(tel, goalX, goalY)
                        last_crater_escape_t = now
                    else:
                        await _recover(tel, goalX, goalY)
                    # Recovery yanks the rover around; drop any wall-follow
                    # episode so we re-evaluate from the new pose.
                    wall = None
                    boulder_streak = 0
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now

            if wall is None:
                # Track persistence of front-blockage to decide if simple
                # boulder-avoidance is failing; combine with width to enter
                # wall-follow promptly when the obstacle is clearly wide.
                if blocked:
                    boulder_streak += 1
                else:
                    boulder_streak = 0
                wide = _wide_obstacle(lidar_pre)
                if blocked and (wide or boulder_streak >= WALL_FOLLOW_PERSIST_STEPS):
                    side = _pick_wall_side(lidar_pre)
                    wall = _WallFollow(side=side, start_t=now)
                    boulder_streak = 0
                    logger.warning(
                        "entering wall-follow (side=%s, wide=%s, streak=%d)",
                        side,
                        wide,
                        boulder_streak,
                    )

            if wall is not None:
                elapsed = now - wall.start_t
                if elapsed > WALL_FOLLOW_TIMEOUT_S:
                    logger.warning(
                        "wall-follow timeout after %.1fs — reverting to drive", elapsed
                    )
                    wall = None
                elif _can_exit_wall(lidar_pre, tel, goalX, goalY, wall.side):
                    logger.info(
                        "wall-follow exit (side=%s, elapsed=%.1fs)", wall.side, elapsed
                    )
                    wall = None

            if wall is not None:
                await _wall_follow_step(tel, wall)
            else:
                await _drive_step(tel, goalX, goalY)
            await asyncio.sleep(COMMAND_PAUSE_S)
            await _brake_pulse()
    except asyncio.CancelledError:
        await _full_stop()
        raise
