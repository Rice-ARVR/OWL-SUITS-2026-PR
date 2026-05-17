"""Simple autonomous drive: travel(goalX, goalY) -> int (0 = success).

Lidar-based driver. Shared geometry, control primitives, and pacing/stuck
constants live in `..navigation_helpers`; only the lidar-specific
classification, wall-following, and escape logic lives here.

Conventions:
- Steering: positive = right (CW), negative = left (CCW); magnitude in [-1, 1].
- Heading: 0° = +Y, 90° = +X (CW from +Y). `_bearing_to` returns this frame.
- Pacing: throttle is kept low and every command is followed by a pause and a
  brake-pulse so the TSS state catches up — necessary to mask the round-trip
  latency between commands and telemetry.
"""

import asyncio
import logging
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.services.navigation.navigation_helpers import (
    ARRIVAL_THRESHOLD_M,
    COMMAND_PAUSE_S,
    STEERING_SIGN,
    STUCK_DIST_M,
    STUCK_WINDOW_S,
    TELEMETRY_FRESH_WAIT_S,
    THROTTLE_NORMAL,
    THROTTLE_REVERSE,
    THROTTLE_SLOW,
    TRAVEL_TIMEOUT_S,
    _bound,
    _brake_pulse,
    _distance_to,
    _full_stop,
    _goal_steering,
    _read_telemetry,
    _send_drive,
)

logger = logging.getLogger(__name__)

# Set False to silence per-loop INFO chatter; WARNING/ERROR still go through.
VERBOSE_LOGGING = True


# ─── Tunables ─────────────────────────────────────────────────────────────────
#
# Shared tunables (ARRIVAL_THRESHOLD_M, TRAVEL_TIMEOUT_S, COMMAND_PAUSE_S,
# BRAKE_PULSE_S, TELEMETRY_FRESH_WAIT_S, MAX_SPEED, THROTTLE_NORMAL/SLOW/REVERSE,
# STEERING_GAIN_DEG, STEERING_SIGN, STUCK_DIST_M, STUCK_WINDOW_S) are imported
# from navigation_helpers. Only lidar-specific tunables are defined here.

#####################
## System Settings ##
#####################

# Speed / throttle (throttle ±100) — boost is lidar-only (crater climb-out).
THROTTLE_BOOST = 60

# Steering
AVOID_STEER = 0.8
SIDE_BIAS_MARGIN_CM = 50.0  # min clearance delta to commit to a side
CRATER_BIAS_WEIGHT = 0.3

# Priority order in _drive_step: boulders override, heading dominates, craters nudge.

# Forced reorientation
REORIENT_ERROR_DEG = 60.0
REORIENT_HOLD_S = 2.0
REORIENT_THROTTLE = 20


########################################
## Obstacle Classification Thresholds ##
########################################

# Front-blockage thresholds
FRONT_OBSTACLE_CM = 900.0  # s2 below this = tall obstacle ahead
TALL_OBSTACLE_BRAKE_CM = 600.0  # s2 below this = brake + reverse out
GROUND_OBSTACLE_MAX_CM = 300.0  # s5/s6 below this = ground obstacle
GROUND_CRATER_MIN_CM = 600.0  # s5/s6 above this (and < NO_HIT) = crater

# Direct-ahead small-obstacle handling (s5/s6 pitched down see immediate path).
DIRECT_AHEAD_OBSTACLE_CM = 300.0
DIRECT_AHEAD_CRITICAL_CM = 150.0
DIRECT_AHEAD_STEER = 0.9
DIRECT_REVERSE_DURATION_S = 3.0

# Predictive turning from angled forward sensors (0/15 right, 4/16 left).
PREDICTIVE_AVOID_CM = 900.0
PREDICTIVE_NUDGE_WEIGHT = 0.8

# Tall-obstacle reverse maneuver
TALL_REVERSE_DURATION_S = 5.0

####################
## Wall Following ##
####################

WALL_FOLLOW_TIMEOUT_S = 120.0
WALL_FOLLOW_PERSIST_STEPS = 2
WALL_TRIGGER_WIDE_CM = 800.0
WALL_TARGET_CM = 450.0  # desired standoff from the wall
WALL_DEADBAND_CM = 80.0
WALL_GAIN = 1.0 / 350.0  # steering per cm of standoff error (clipped to ±1)
WALL_FRONT_CLEAR_CM = 900.0
WALL_SIDE_CLEAR_CM = 800.0
WALL_EXIT_HEADING_DEG = 20.0
WALL_FRONT_BLOCKED_STEER = 0.9
WALL_LOST_SIDE_STEER = 0.4
WALL_GONE_CM = 950.0  # lateral + forward both above this on wall side = passed
WALL_THROTTLE = 30

# Most-lateral wall-side sensors used to measure standoff.
WALL_RIGHT_SIDE_SENSOR = 0  # 30°R at right wheel hub
WALL_LEFT_SIDE_SENSOR = 4  # 30°L at left wheel hub

######################
## Escape Protocols ##
######################

# Stuck detection / recovery (STUCK_DIST_M, STUCK_WINDOW_S from navigation_helpers)
MAX_RECOVERY_ATTEMPTS = 4
REVERSE_DURATION_S = 5.0
REORIENT_DURATION_S = 2.5

# Crater escape
CRATER_ESCAPE_DURATION_S = 5.0
CRATER_ESCAPE_COOLDOWN_S = 15.0
CRATER_PITCH_DEG = -10.0  # nose-down beyond this => sitting in a pit

######################
## Sensor groupings ##
######################

# Lidar
LIDAR_NO_HIT = 9999.0

# General Categories
FRONT_SENSORS = (2, 5, 6)
LEFT_SENSORS = (3, 4, 14, 16)
RIGHT_SENSORS = (0, 1, 13, 15)

# Angled forward pairs for predictive turning.
FRONT_RIGHT_PREDICT = (0, 15)  # 30°R, 15°R
FRONT_LEFT_PREDICT = (4, 16)  # 30°L, 15°L

# Primary forward groups for direct-ahead side selection — wider than just
# s5/s6 so we pick a flank that actually has room to swing into.
DIRECT_LEFT_PRIMARY = (3, 6, 14)
DIRECT_RIGHT_PRIMARY = (1, 5, 13)


# ─── Logging helper ───────────────────────────────────────────────────────────


def _log_info(msg: str, *args) -> None:
    """Gated INFO log — silenced when VERBOSE_LOGGING is False."""
    if VERBOSE_LOGGING:
        logger.info(msg, *args)


# ─── Pure helpers: geometry, lidar, side selection ───────────────────────────


def _clean(value: float) -> float:
    """Map raw lidar -1/None (no detection) to LIDAR_NO_HIT; pass others through."""
    return LIDAR_NO_HIT if value is None or value < 0 else value


def _preprocess_lidar(lidar: List[float]) -> List[float]:
    """Apply `_clean` to every return."""
    return [_clean(v) for v in lidar]


def _side_clearance(lidar: List[float], indices: Tuple[int, ...]) -> float:
    """Minimum lidar return across `indices`."""
    return min(lidar[i] for i in indices)


def _pick_clearer_side(
    left: float, right: float, margin: float, tie: str = "left"
) -> str:
    """Return 'left' or 'right' — the side with more clearance, with `margin` deadband."""
    if left > right + margin:
        return "left"
    if right > left + margin:
        return "right"
    return tie


# ─── Obstacle classification ─────────────────────────────────────────────────


def _boulder_blocked(lidar: List[float]) -> Tuple[bool, str]:
    """Hard obstacle directly in the rover's path — must override heading-to-goal."""
    s2, s5, s6 = lidar[2], lidar[5], lidar[6]
    if s2 < FRONT_OBSTACLE_CM:
        return True, f"obstacle ahead (s2={s2:.0f})"
    if s5 < GROUND_OBSTACLE_MAX_CM or s6 < GROUND_OBSTACLE_MAX_CM:
        return True, f"ground obstacle (s5={s5:.0f}, s6={s6:.0f})"
    return False, ""


def _crater_ahead(lidar: List[float]) -> Tuple[bool, str]:
    """Drop-off in front — soft hazard, only nudges heading."""
    s5, s6 = lidar[5], lidar[6]
    if GROUND_CRATER_MIN_CM < s5 < LIDAR_NO_HIT:
        return True, f"crater (s5={s5:.0f})"
    if GROUND_CRATER_MIN_CM < s6 < LIDAR_NO_HIT:
        return True, f"crater (s6={s6:.0f})"
    return False, ""


def _direct_ahead_state(lidar: List[float]) -> Tuple[str, str]:
    """Classify direct-ahead small-obstacle from s5/s6: 'critical' | 'avoid' | 'clear'."""
    s5, s6 = lidar[5], lidar[6]
    if s5 < DIRECT_AHEAD_CRITICAL_CM or s6 < DIRECT_AHEAD_CRITICAL_CM:
        return "critical", f"direct critical s5={s5:.0f} s6={s6:.0f}"
    if s5 < DIRECT_AHEAD_OBSTACLE_CM or s6 < DIRECT_AHEAD_OBSTACLE_CM:
        return "avoid", f"direct ahead s5={s5:.0f} s6={s6:.0f}"
    return "clear", ""


# ─── Side-selection steering ─────────────────────────────────────────────────


def _choose_avoidance_steering(lidar: List[float]) -> float:
    """Steer toward the clearer broad flank for boulder dodge."""
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    side = _pick_clearer_side(left, right, SIDE_BIAS_MARGIN_CM, tie="left")
    sign = -1.0 if side == "left" else 1.0
    return sign * AVOID_STEER * STEERING_SIGN


def _direct_ahead_steering(lidar: List[float]) -> Tuple[float, str]:
    """Sharp dodge toward the clearer primary forward group.

    Ties on the primary groups break on s5 vs s6: whichever pitched-down sensor
    reads closer indicates the obstacle's lean, so steer the opposite way.
    """
    left = _side_clearance(lidar, DIRECT_LEFT_PRIMARY)
    right = _side_clearance(lidar, DIRECT_RIGHT_PRIMARY)
    tie = "left" if lidar[5] < lidar[6] else "right"
    side = _pick_clearer_side(left, right, SIDE_BIAS_MARGIN_CM, tie=tie)
    sign = -1.0 if side == "left" else 1.0
    steer = sign * DIRECT_AHEAD_STEER * STEERING_SIGN
    why = f"L={left:.0f} R={right:.0f}"
    if abs(left - right) <= SIDE_BIAS_MARGIN_CM:
        marker = "s5<s6" if lidar[5] < lidar[6] else "s6<=s5"
        why = f"tie {why} ({marker})"
    return steer, why


def _predictive_steer_bias(lidar: List[float]) -> Tuple[float, str]:
    """Nudge toward the clearer angled-front side; 0 in fully open terrain."""
    right = _side_clearance(lidar, FRONT_RIGHT_PREDICT)
    left = _side_clearance(lidar, FRONT_LEFT_PREDICT)
    if right >= PREDICTIVE_AVOID_CM and left >= PREDICTIVE_AVOID_CM:
        return 0.0, ""
    side = _pick_clearer_side(left, right, SIDE_BIAS_MARGIN_CM, tie="left")
    sign = -1.0 if side == "left" else 1.0
    bias = sign * PREDICTIVE_NUDGE_WEIGHT * STEERING_SIGN
    why = f"predict L={left:.0f} R={right:.0f}"
    if abs(left - right) <= SIDE_BIAS_MARGIN_CM:
        why += " (tie-left)"
    return bias, why


def _choose_reverse_steering(lidar: List[float]) -> Tuple[float, str]:
    """Pick reverse-steer so the body rotates toward the clearer side.

    Bicycle-model kinematics: reversing + positive steering rotates the body
    CCW (front swings left). So reverse_steer = -(forward intent toward clearer side).
    """
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    side = _pick_clearer_side(left, right, SIDE_BIAS_MARGIN_CM, tie="left")
    forward_sign = -1.0 if side == "left" else 1.0
    reverse_steer = -forward_sign * STEERING_SIGN  # full lock (magnitude 1.0)
    return reverse_steer, f"clear-{side} L={left:.0f} R={right:.0f}"


# ─── Wall-following helpers + state ──────────────────────────────────────────


@dataclass
class _WallFollow:
    """State carried across iterations while wall-following is active."""

    side: str  # 'left' or 'right' — which flank the wall is on
    start_t: float  # loop time when this episode began


def _wide_obstacle(lidar: List[float]) -> bool:
    """True when both forward-angled sides see something close — a wide wall."""
    right = _side_clearance(lidar, FRONT_RIGHT_PREDICT)
    left = _side_clearance(lidar, FRONT_LEFT_PREDICT)
    return right < WALL_TRIGGER_WIDE_CM and left < WALL_TRIGGER_WIDE_CM


def _pick_wall_side(lidar: List[float]) -> str:
    """Put the wall on the *tighter* side so the open side stays free for the escape turn."""
    left = _side_clearance(lidar, LEFT_SENSORS)
    right = _side_clearance(lidar, RIGHT_SENSORS)
    return "left" if left <= right else "right"


def _wall_distance(lidar: List[float], side: str) -> float:
    """Lateral standoff sensor reading on the wall side."""
    return lidar[WALL_LEFT_SIDE_SENSOR if side == "left" else WALL_RIGHT_SIDE_SENSOR]


def _wall_front_predict(lidar: List[float], side: str) -> float:
    """Forward-angled return on the wall side — flags an inside corner closing in."""
    indices = FRONT_LEFT_PREDICT if side == "left" else FRONT_RIGHT_PREDICT
    return _side_clearance(lidar, indices)


def _wall_is_gone(lidar: List[float], side: str) -> bool:
    """True when both lateral and forward-side returns indicate the wall has ended."""
    return (
        _wall_distance(lidar, side) >= WALL_GONE_CM
        and _wall_front_predict(lidar, side) >= WALL_GONE_CM
    )


def _can_exit_wall(
    lidar: List[float], tel, goalX: float, goalY: float, side: str
) -> bool:
    """Exit when either the wall has ended, or the goal lies on the open flank.

    With wall on left we need err > +threshold (goal CW of heading); with wall
    on right we need err < -threshold (goal CCW).
    """
    if lidar[2] < WALL_FRONT_CLEAR_CM:
        return False

    if _wall_is_gone(lidar, side):
        return True

    _, err = _goal_steering(tel, goalX, goalY)
    if side == "left":
        if err < WALL_EXIT_HEADING_DEG:
            return False
        away_clear = _side_clearance(lidar, FRONT_RIGHT_PREDICT) > WALL_SIDE_CLEAR_CM
    else:
        if err > -WALL_EXIT_HEADING_DEG:
            return False
        away_clear = _side_clearance(lidar, FRONT_LEFT_PREDICT) > WALL_SIDE_CLEAR_CM
    return away_clear


def _wall_follow_steering(lidar: List[float], side: str) -> Tuple[float, str]:
    """Proportional standoff control with overrides for closed front and lost wall.

    `toward_sign` points toward the wall: -1 (left wall) / +1 (right wall).
    """
    front_side = _wall_front_predict(lidar, side)
    side_dist = _wall_distance(lidar, side)
    toward_sign = -1.0 if side == "left" else 1.0

    # Inside corner: turn hard AWAY from the wall.
    if front_side < WALL_TRIGGER_WIDE_CM * 0.6 or lidar[2] < FRONT_OBSTACLE_CM:
        steer = -toward_sign * WALL_FRONT_BLOCKED_STEER * STEERING_SIGN
        return steer, f"corner-in front_side={front_side:.0f} s2={lidar[2]:.0f}"

    # Lost the wall — bend gently TOWARD it so we don't lose the reference.
    if side_dist >= LIDAR_NO_HIT - 1:
        steer = toward_sign * WALL_LOST_SIDE_STEER * STEERING_SIGN
        return steer, f"wall lost (side={side_dist:.0f})"

    # Proportional standoff. err > 0 => too far => steer toward wall.
    err = side_dist - WALL_TARGET_CM
    if abs(err) < WALL_DEADBAND_CM:
        return 0.0, f"on-line side={side_dist:.0f}"
    steer = _bound(toward_sign * WALL_GAIN * err * STEERING_SIGN, -1.0, 1.0)
    return steer, f"track side={side_dist:.0f} err={err:+.0f}"


def _in_crater(lidar: List[float], pitch: Optional[float]) -> bool:
    """True when any of three signals say the rover is sitting in a pit:
    front pitched-down sensors overshoot the rim, side pitched-down sensors
    lose ground return, or body pitch is well nose-down."""
    s5, s6, s7, s8 = lidar[5], lidar[6], lidar[7], lidar[8]
    front_overshoot = (
        GROUND_CRATER_MIN_CM < s5 < LIDAR_NO_HIT
        or GROUND_CRATER_MIN_CM < s6 < LIDAR_NO_HIT
    )
    # 7/8 pitched 20° down sideways always see something on flat ground; a
    # NO_HIT return means the ground dropped away on that side.
    side_overshoot = s7 >= LIDAR_NO_HIT - 1 or s8 >= LIDAR_NO_HIT - 1
    nose_down = pitch is not None and pitch < CRATER_PITCH_DEG
    return front_overshoot or side_overshoot or nose_down


# ─── Mid-level maneuvers ─────────────────────────────────────────────────────


async def _reverse_and_clear(lidar: List[float], duration: float, why: str) -> None:
    """Brake, then reverse with steering that swings the front toward the clearer flank."""
    reverse_steer, side_why = _choose_reverse_steering(lidar)
    logger.warning(
        "REVERSE+CLEAR (%s): %s steer=%+.2f dur=%.1fs",
        why,
        side_why,
        reverse_steer,
        duration,
    )

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_drive(THROTTLE_REVERSE, reverse_steer)
    await asyncio.sleep(duration)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


async def _tall_obstacle_evade(lidar: List[float]) -> None:
    """Reverse out of a too-close tall obstacle (s2 < TALL_OBSTACLE_BRAKE_CM)."""
    await _reverse_and_clear(
        lidar, TALL_REVERSE_DURATION_S, f"tall obstacle s2={lidar[2]:.0f}"
    )


async def _crater_escape(tel, goalX: float, goalY: float) -> None:
    """Boosted-throttle climb-out from a pit, aimed at the goal.

    Drives the rover directly (not via _drive_step) so the MAX_SPEED clamp is
    skipped — the burst would otherwise be braked back to walking pace.
    """
    steer, err = _goal_steering(tel, goalX, goalY)
    logger.warning(
        "CRATER ESCAPE: boost throttle=%d for %.1fs steer=%+.2f (err=%+.1f°)",
        THROTTLE_BOOST,
        CRATER_ESCAPE_DURATION_S,
        steer,
        err,
    )

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_drive(THROTTLE_BOOST, steer)
    await asyncio.sleep(CRATER_ESCAPE_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


async def _recover(tel, goalX: float, goalY: float) -> None:
    """Three-point-turn recovery: reverse with opposite steer to swing the body
    toward the goal heading, then arc forward."""
    logger.warning("recovery: reverse + reorient")

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    forward_steer, _ = _goal_steering(tel, goalX, goalY)
    reverse_steer = -forward_steer

    await _send_drive(THROTTLE_REVERSE, reverse_steer)
    await asyncio.sleep(REVERSE_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)

    await _send_drive(THROTTLE_SLOW, forward_steer)
    await asyncio.sleep(REORIENT_DURATION_S)

    await _full_stop()
    await asyncio.sleep(COMMAND_PAUSE_S)


# ─── Step functions ──────────────────────────────────────────────────────────


async def _drive_step(tel, goalX: float, goalY: float) -> None:
    """One driving iteration: pick steering+throttle from sensors and goal."""
    lidar = _preprocess_lidar(tel.lidar)

    # P0: very close tall obstacle — brake + reverse out before any forward command.
    if lidar[2] < TALL_OBSTACLE_BRAKE_CM:
        await _tall_obstacle_evade(lidar)
        return

    # P1: critically close direct-ahead rock — too tight to swing past.
    direct_state, direct_why = _direct_ahead_state(lidar)
    if direct_state == "critical":
        await _reverse_and_clear(lidar, DIRECT_REVERSE_DURATION_S, direct_why)
        return

    heading_steer, err = _goal_steering(tel, goalX, goalY)
    boulder, boulder_why = _boulder_blocked(lidar)

    if direct_state == "avoid":
        # P2: small obstacle directly in front — sharp dodge via primary forward groups.
        steering, side_why = _direct_ahead_steering(lidar)
        throttle = THROTTLE_SLOW
        _log_info(
            "DIRECT avoid: %s (%s) -> steer=%+.2f", direct_why, side_why, steering
        )
    elif boulder:
        # P3: tall/wide hard obstacle on s2 — override heading.
        steering = _choose_avoidance_steering(lidar)
        throttle = THROTTLE_SLOW
        _log_info("BOULDER avoid: %s -> steer=%+.2f", boulder_why, steering)
    else:
        crater, crater_why = _crater_ahead(lidar)
        predict_bias, predict_why = _predictive_steer_bias(lidar)
        if crater:
            # P4: crater — heading still leads, small nudge toward clearer side.
            bias = _choose_avoidance_steering(lidar) * CRATER_BIAS_WEIGHT
            steering = _bound(heading_steer + bias + predict_bias, -1.0, 1.0)
            throttle = THROTTLE_SLOW
            _log_info(
                "crater nudge: %s -> steer=%+.2f (hdg=%+.2f, crater=%+.2f, %s=%+.2f)",
                crater_why,
                steering,
                heading_steer,
                bias,
                predict_why or "predict",
                predict_bias,
            )
        elif predict_bias != 0.0:
            # P5: predictive turn — angled front sensors see something dodge-worthy.
            steering = _bound(heading_steer + predict_bias, -1.0, 1.0)
            throttle = THROTTLE_SLOW
            _log_info(
                "predictive nudge: %s -> steer=%+.2f (hdg=%+.2f, bias=%+.2f)",
                predict_why,
                steering,
                heading_steer,
                predict_bias,
            )
        else:
            # P6: pure heading-to-goal.
            steering = heading_steer
            throttle = THROTTLE_SLOW if abs(err) > 30 else THROTTLE_NORMAL

    # Apply speed cap dynamically without abandoning the maneuver
    brakes = 0.0
    if tel.speed >= MAX_SPEED:
        throttle = 0.0  # Cut power
        brakes = (
            0.5  # Apply soft brakes (0.5 instead of 1.0) to maintain turning traction
        )
        _log_info("Speed cap applied: slowing down while maneuvering.")

    await _send_drive(throttle, steering, brakes)


async def _wall_follow_step(tel, state: _WallFollow) -> None:
    """One wall-following iteration."""
    lidar = _preprocess_lidar(tel.lidar)

    # Tall-obstacle override still applies — back out before we ram the wall.
    if lidar[2] < TALL_OBSTACLE_BRAKE_CM:
        await _tall_obstacle_evade(lidar)
        return

    steering, why = _wall_follow_steering(lidar, state.side)
    _log_info("WALL(%s): %s -> steer=%+.2f", state.side, why, steering)

    # Apply speed cap dynamically without abandoning the maneuver
    throttle = WALL_THROTTLE
    brakes = 0.0
    if tel.speed >= MAX_SPEED:
        throttle = 0.0  # Cut power
        brakes = (
            0.5  # Apply soft brakes (0.5 instead of 1.0) to maintain turning traction
        )
        _log_info("Speed cap applied: slowing down while maneuvering.")

    await _send_drive(throttle, steering, brakes)


# ─── Public entry point ──────────────────────────────────────────────────────


async def travel(goalX: float, goalY: float) -> int:
    """Drive within ARRIVAL_THRESHOLD_M of (goalX, goalY).

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
            _log_info(
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
                    if (
                        _in_crater(lidar_pre, getattr(tel, "pitch", None))
                        and now - last_crater_escape_t >= CRATER_ESCAPE_COOLDOWN_S
                    ):
                        await _crater_escape(tel, goalX, goalY)
                        last_crater_escape_t = now
                    else:
                        await _recover(tel, goalX, goalY)
                    # Recovery yanks the rover around; re-evaluate from the new pose.
                    wall = None
                    boulder_streak = 0
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now

            if wall is None:
                if blocked:
                    boulder_streak += 1
                else:
                    boulder_streak = 0
                wide = _wide_obstacle(lidar_pre)
                if blocked and (wide or boulder_streak >= WALL_FOLLOW_PERSIST_STEPS):
                    side = _pick_wall_side(lidar_pre)
                    logger.warning(
                        "entering wall-follow (side=%s, wide=%s, streak=%d)",
                        side,
                        wide,
                        boulder_streak,
                    )
                    wall = _WallFollow(side=side, start_t=now)
                    boulder_streak = 0

            if wall is not None:
                elapsed = now - wall.start_t
                if elapsed > WALL_FOLLOW_TIMEOUT_S:
                    logger.warning(
                        "wall-follow timeout after %.1fs — reverting to drive", elapsed
                    )
                    wall = None
                elif _can_exit_wall(lidar_pre, tel, goalX, goalY, wall.side):
                    _log_info(
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
