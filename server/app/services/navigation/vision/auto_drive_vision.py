"""Vision-based autonomous drive: travel_vision(targetX, targetY) -> int.

Consumes the YOLO obstacle detections published by `cv_service` (craters,
boulders, Lunar Home Base, Lunar Terrain Vehicle) and steers the rover toward
a goal while keeping all four obstacle classes out of its path.

Returns 0 on success (within ARRIVAL_THRESHOLD_M of the target), 1 to hand
control back to the user (stuck / boxed-in / timeout / no vision feed).

Conventions (shared with the lidar driver — see navigation_helpers):
- Steering: positive = right (CW), negative = left (CCW); magnitude in [-1, 1].
- Heading: 0° = +Y, 90° = +X (CW from +Y).
- Throttle: ±100 scale.
- Pacing: low throttle; every command is followed by a pause and a brake-pulse
  so the TSS state catches up to the round-trip command/telemetry latency.

Steering model (12-column scan):
- The frame width is split into 12 equal columns. Every column a detection's
  bbox spans accrues a danger score = proximity × column_weight.
- proximity ∈ [0,1] is a depth-free proxy: closer obstacles have a larger and
  lower bbox, so it blends normalized bbox area with the bbox bottom edge.
- column_weight is symmetric, peaking at the two center columns and tapering to
  the edges, so an obstacle dead-ahead outweighs one at the periphery.
- Left-half danger (cols 0–5) vs right-half danger (cols 6–11) decides the turn
  direction: steer away from the heavier half. An exact tie breaks LEFT.
"""

import asyncio
import logging
from typing import List, Optional, Tuple

import app.services.navigation.vision.cv_service as cv_service
from app.services.navigation.navigation_helpers import (
    ARRIVAL_THRESHOLD_M,
    COMMAND_PAUSE_S,
    STUCK_DIST_M,
    STUCK_WINDOW_S,
    THROTTLE_NORMAL,
    THROTTLE_SLOW,
    TRAVEL_TIMEOUT_S,
    _apply_speed_cap,
    _bound,
    _brake_pulse,
    _distance_to,
    _full_stop,
    _goal_steering,
    _read_telemetry,
    _send_drive,
)
from app.services.navigation.vision.cv_service import CVResult, Detection

logger = logging.getLogger(__name__)

# Set False to silence per-loop INFO chatter; WARNING/ERROR still go through.
VERBOSE_LOGGING = True


# ─── Tunables ─────────────────────────────────────────────────────────────────
#
# Shared tunables (ARRIVAL_THRESHOLD_M, TRAVEL_TIMEOUT_S, COMMAND_PAUSE_S,
# STUCK_DIST_M, STUCK_WINDOW_S, THROTTLE_NORMAL/SLOW) come from
# navigation_helpers. Only vision-specific tunables live here.

# 12-column scan
N_COLUMNS = 12
CENTER_COLS = (4, 5, 6, 7)  # "directly in front" band, for blockage test
EDGE_WEIGHT = 0.20  # column weight at the frame edges (center weight = 1.0)

# Proximity proxy (depth-free): blend of bbox area and bbox bottom edge.
PROX_AREA_WEIGHT = 0.5
PROX_BOTTOM_WEIGHT = 0.5
# A bbox covering this fraction of the frame counts as maximally close on the
# area axis (so a moderately-sized box already reads as a real threat).
AREA_FULL_FRAC = 0.20

# Steering response
VISION_AVOID_STEER = 0.9  # max avoidance steer magnitude
MIN_AVOID_STEER = 0.35  # floor so a detected obstacle always produces a turn
HEADING_BLEND = 0.25  # how much goal-heading leaks through during avoidance

# Engagement / blockage thresholds (units: Σ proximity·weight)
AVOID_TRIGGER = 0.12  # total weighted danger above which avoidance engages
CENTER_BLOCK_DANGER = 0.55  # center-band danger above this = path blocked
BOXED_IN_STEPS = 4  # consecutive blocked-both-sides steps before giving up

# Vision feed health
NO_FRAME_TIMEOUT_S = 10.0  # no CVResult for this long => hand back to user
FIRST_FRAME_TIMEOUT_S = 15.0  # never got a first frame => hand back to user


# ─── Logging helper ───────────────────────────────────────────────────────────


def _log_info(msg: str, *args) -> None:
    """Gated INFO log — silenced when VERBOSE_LOGGING is False."""
    if VERBOSE_LOGGING:
        logger.info(msg, *args)


# ─── Pure helpers: column model ───────────────────────────────────────────────


def _column_weights() -> List[float]:
    """Symmetric triangular profile, 1.0 at the center columns → EDGE_WEIGHT at
    the edges. Precomputed once at import."""
    center = (N_COLUMNS - 1) / 2.0  # 5.5 for 12 columns
    weights: List[float] = []
    for i in range(N_COLUMNS):
        closeness = 1.0 - abs(i - center) / center  # 1 at center, 0 at edge
        weights.append(EDGE_WEIGHT + (1.0 - EDGE_WEIGHT) * closeness)
    return weights


_WEIGHTS = _column_weights()


def _proximity(bbox: Tuple[int, int, int, int], width: int, height: int) -> float:
    """Depth-free closeness proxy ∈ [0,1] for one detection.

    A closer obstacle subtends a larger box that sits lower in the frame, so
    blend normalized bbox area with the normalized bbox bottom edge.
    """
    if width <= 0 or height <= 0:
        return 0.0
    x1, y1, x2, y2 = bbox
    box_w = max(0, x2 - x1)
    box_h = max(0, y2 - y1)
    area_frac = (box_w * box_h) / float(width * height)
    area_term = min(1.0, area_frac / AREA_FULL_FRAC)
    bottom_term = _bound(y2 / float(height), 0.0, 1.0)
    return _bound(
        PROX_AREA_WEIGHT * area_term + PROX_BOTTOM_WEIGHT * bottom_term, 0.0, 1.0
    )


def _column_danger(detections: List[Detection], width: int, height: int) -> List[float]:
    """Accumulate per-column danger: every column a bbox spans gets += proximity.

    All four obstacle classes are treated as solid no-go regions (the rover can
    no more drive through a crater than over the base or the LTV).
    """
    danger = [0.0] * N_COLUMNS
    if width <= 0:
        return danger
    col_w = width / float(N_COLUMNS)
    for det in detections:
        x1, _, x2, _ = det.bbox
        p = _proximity(det.bbox, width, height)
        if p <= 0.0:
            continue
        c1 = int(_bound(x1 // col_w, 0, N_COLUMNS - 1))
        c2 = int(_bound((x2 - 1) // col_w, 0, N_COLUMNS - 1))
        for c in range(min(c1, c2), max(c1, c2) + 1):
            danger[c] += p
    return danger


def _vision_steering(danger: List[float]) -> Tuple[float, bool, float]:
    """Map the column-danger profile to (steer, center_blocked, total_weighted).

    steer is the obstacle-avoidance steering only (goal heading is blended in by
    the caller). An exact left/right tie breaks LEFT (negative).
    """
    weighted = [danger[i] * _WEIGHTS[i] for i in range(N_COLUMNS)]
    half = N_COLUMNS // 2
    left_cost = sum(weighted[:half])  # cols 0–5
    right_cost = sum(weighted[half:])  # cols 6–11
    total = left_cost + right_cost
    center_danger = sum(weighted[c] for c in CENTER_COLS)
    center_blocked = center_danger >= CENTER_BLOCK_DANGER

    if total < AVOID_TRIGGER:
        return 0.0, center_blocked, total

    # Tie (and right-heavy) -> steer LEFT (negative); left-heavy -> steer right.
    direction = 1.0 if left_cost > right_cost else -1.0

    if center_blocked:
        # Something solid dead-ahead: commit to a hard turn regardless of gap.
        magnitude = VISION_AVOID_STEER
    else:
        gap_frac = abs(left_cost - right_cost) / total
        magnitude = _bound(
            gap_frac * VISION_AVOID_STEER, MIN_AVOID_STEER, VISION_AVOID_STEER
        )
    return direction * magnitude, center_blocked, total


def _both_sides_blocked(danger: List[float]) -> bool:
    """True when every center column carries danger — no clear lane either way."""
    return all(danger[c] > 0.0 for c in CENTER_COLS)


# ─── CV feed helper ───────────────────────────────────────────────────────────


def _drain_latest(q: "asyncio.Queue[CVResult]") -> Optional[CVResult]:
    """Pop everything queued and return only the newest CVResult (or None)."""
    latest: Optional[CVResult] = None
    while True:
        try:
            latest = q.get_nowait()
        except asyncio.QueueEmpty:
            break
    return latest


# ─── Public entry point ───────────────────────────────────────────────────────


async def travel_vision(
    targetX: float,
    targetY: float,
    arrival_threshold: float = 5.0,
    interrupt_event: Optional[asyncio.Event] = None,
) -> int:
    """Drive within ARRIVAL_THRESHOLD_M of (targetX, targetY) using vision only.

    Returns 0 on success, 1 to return manual control (stuck / boxed-in /
    timeout / dead vision feed).
    """
    loop = asyncio.get_event_loop()
    started = loop.time()

    q = await cv_service.subscribe()

    last_frame_t: Optional[float] = None
    last_result: Optional[CVResult] = None

    stuck_anchor: Optional[Tuple[float, float]] = None
    stuck_anchor_t = 0.0
    boxed_streak = 0

    try:
        while True:
            now = loop.time()

            # Check for the interrupt signal from the API
            if interrupt_event and interrupt_event.is_set():
                logger.warning("travel_vision: interrupted by manual ping")
                await _full_stop()  # Turn on the brakes!
                return 2  # Return the special interrupt code

            if now - started > TRAVEL_TIMEOUT_S:
                logger.error("travel_vision: timeout")
                await _full_stop()
                return 1

            tel = await _read_telemetry()
            if tel is None:
                await asyncio.sleep(COMMAND_PAUSE_S)
                continue

            dist = _distance_to(targetX, targetY, tel.rover_pos_x, tel.rover_pos_y)
            if dist <= ARRIVAL_THRESHOLD_M:
                await _full_stop()
                logger.info("travel_vision: arrived (dist=%.1fm)", dist)
                return 0

            # ── Pull the freshest CV frame; fail if the feed is dead ──────────
            result = _drain_latest(q)
            if result is not None:
                last_result = result
                last_frame_t = now
            elif last_frame_t is None:
                if now - started > FIRST_FRAME_TIMEOUT_S:
                    logger.error("travel_vision: no CV frames — vision feed down")
                    await _full_stop()
                    return 1
                await asyncio.sleep(COMMAND_PAUSE_S)
                continue
            elif now - last_frame_t > NO_FRAME_TIMEOUT_S:
                logger.error(
                    "travel_vision: CV feed stalled %.1fs — handing back control",
                    now - last_frame_t,
                )
                await _full_stop()
                return 1

            assert last_result is not None
            h, w = last_result.frame.shape[:2]
            danger = _column_danger(last_result.detections, w, h)
            avoid_steer, center_blocked, total = _vision_steering(danger)
            heading_steer, err = _goal_steering(tel, targetX, targetY)

            # ── Boxed-in detection: center blocked with no clear flank ───────
            if center_blocked and _both_sides_blocked(danger):
                boxed_streak += 1
                if boxed_streak >= BOXED_IN_STEPS:
                    logger.error(
                        "travel_vision: boxed in (%d steps) — handing back control",
                        boxed_streak,
                    )
                    await _full_stop()
                    return 1
            else:
                boxed_streak = 0

            # ── Steering: avoidance dominates, goal heading leaks through ────
            if total >= AVOID_TRIGGER:
                steering = _bound(
                    avoid_steer + HEADING_BLEND * heading_steer, -1.0, 1.0
                )
                throttle = THROTTLE_SLOW
                _log_info(
                    "AVOID dist=%.1f total=%.2f center=%s -> steer=%+.2f "
                    "(avoid=%+.2f hdg=%+.2f)",
                    dist,
                    total,
                    center_blocked,
                    steering,
                    avoid_steer,
                    heading_steer,
                )
            else:
                steering = heading_steer
                throttle = THROTTLE_SLOW if abs(err) > 30 else THROTTLE_NORMAL
                _log_info(
                    "CLEAR dist=%.1f hdg=%.1f err=%+.1f -> steer=%+.2f",
                    dist,
                    tel.heading,
                    err,
                    steering,
                )

            # ── Stuck detection over a rolling window -> hand back control ───
            if stuck_anchor is None:
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now
            elif now - stuck_anchor_t >= STUCK_WINDOW_S:
                moved = _distance_to(
                    stuck_anchor[0],
                    stuck_anchor[1],
                    tel.rover_pos_x,
                    tel.rover_pos_y,
                )
                if moved < STUCK_DIST_M:
                    logger.error(
                        "travel_vision: stuck (moved %.2fm in %.1fs) — "
                        "handing back control",
                        moved,
                        now - stuck_anchor_t,
                    )
                    await _full_stop()
                    return 1
                stuck_anchor = (tel.rover_pos_x, tel.rover_pos_y)
                stuck_anchor_t = now

            # ── Issue the command, then pace so TSS state catches up ─────────
            if not await _apply_speed_cap(tel, steering):
                await _send_drive(throttle, steering)
            await asyncio.sleep(COMMAND_PAUSE_S)
            await _brake_pulse()
    except asyncio.CancelledError:
        raise
    finally:
        await cv_service.unsubscribe(q)
