import asyncio
import logging
import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, cast

import app.services.navigation.vision.auto_drive_vision as auto_drive_vision
import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client
from app.models.nav_model import (
    DistanceCategory,
    NavigationStateData,
    NavigationTarget,
    PingRecord,
    Position,
    SearchArea,
    SearchPhase,
    SearchSession,
)
from app.services.rover_control_service import send_rover_command

logger = logging.getLogger(__name__)
logger.propagate = False

# Global state singleton
navigation_state = NavigationStateData()

_mission_task: Optional[asyncio.Task[Any]] = None
_telemetry_task: Optional[asyncio.Task[Any]] = None

PING_COOLDOWN_S = 20.0
ARRIVAL_BUFFER_M = 20.0  # Pure math waypoint fuzzy arrival


# --- Low-Level Driving Helpers ---


async def _brake_and_pause(seconds: float = 4.0) -> None:
    """Slam the brakes and hold position for the required calculation window."""
    # Passing True as a purely positional argument to satisfy Pylance
    await send_rover_command(0.0, 0.0, True)
    await asyncio.sleep(seconds)


# --- Math & Geometry Helpers ---


def _calculate_search_area(ping: PingRecord) -> SearchArea:
    """Calculates donut bounds based on signal category."""
    if ping.signal_category == DistanceCategory.STRONG:
        return SearchArea(
            center=ping.rover_position, radius_min_m=0.0, radius_max_m=100.0
        )
    elif ping.signal_category == DistanceCategory.MODERATE:
        return SearchArea(
            center=ping.rover_position, radius_min_m=100.0, radius_max_m=462.0
        )
    elif ping.signal_category == DistanceCategory.WEAK:
        return SearchArea(
            center=ping.rover_position, radius_min_m=462.0, radius_max_m=1200.0
        )
    else:
        return SearchArea(
            center=ping.rover_position, radius_min_m=1200.0, radius_max_m=2000.0
        )


def _generate_equilateral_triangle(center: Position, radius: float) -> List[Position]:
    """Phase 2: Calculate 3 points in an equilateral triangle around the search center."""
    points: List[Position] = []
    for angle_deg in [0, 120, 240]:
        angle_rad = math.radians(angle_deg)
        x = center.x + radius * math.cos(angle_rad)
        y = center.y + radius * math.sin(angle_rad)
        points.append(Position(x=x, y=y))
    return points


def _calculate_intersection_waypoint(ping_history: List[PingRecord]) -> Position:
    """
    Phase 3: Gradient Ascent / Intersection Math.
    Extrapolates a point based on the last two pings to simulate gradient ascent.
    """
    if len(ping_history) < 2:
        return (
            ping_history[-1].rover_position if ping_history else Position(x=0.0, y=0.0)
        )

    p1 = ping_history[-2]
    p2 = ping_history[-1]

    # If signal improved, continue along that vector. If it got worse, flip it.
    vector_x = p2.rover_position.x - p1.rover_position.x
    vector_y = p2.rover_position.y - p1.rover_position.y

    multiplier = 1.5 if p2.rssi > p1.rssi else -1.0

    return Position(
        x=p2.rover_position.x + (vector_x * multiplier),
        y=p2.rover_position.y + (vector_y * multiplier),
    )


def _generate_archimedes_spiral(
    anchor: Position, max_radius: float = 50.0
) -> List[Position]:
    """Phase 4: Archimedes spiral outwards from the STRONG ping location."""
    points: List[Position] = []
    b = 2.0  # Spiral tightness
    theta = 0.0
    while True:
        r = b * theta
        if r > max_radius:
            break
        x = anchor.x + r * math.cos(theta)
        y = anchor.y + r * math.sin(theta)
        points.append(Position(x=x, y=y))
        theta += math.pi / 4  # 45 degree steps
    return points


# --- Core Mission Loop ---


async def autonomous_mission_loop() -> None:
    """The central state machine commander for the 4-Phase Search Strategy."""
    logger.info("Mission Loop Started.")

    try:
        while True:
            # 1. Fetch freshest state safely
            state = await navigation_state.get_snapshot()
            session = state.session
            rover_pos = state.rover_position

            if not state.autonomous_driving or session is None or rover_pos is None:
                await asyncio.sleep(1.0)
                continue

            current_phase = session.phase
            interrupt_event = navigation_state.get_ping_interrupt_event()

            # ==========================================
            # PHASE 1: Transit to Last Nominal Position
            # ==========================================
            if current_phase == SearchPhase.TRANSIT_TO_LNP:
                target = session.lnp
                session.current_target = NavigationTarget(
                    position=target,
                    description="LNP",
                    arrival_threshold_m=ARRIVAL_BUFFER_M,
                )
                await navigation_state.update_session(session)

                logger.info("Phase 1: Traveling to LNP.")
                result = await auto_drive_vision.travel_vision(
                    target.x,
                    target.y,
                    arrival_threshold=ARRIVAL_BUFFER_M,
                    interrupt_event=interrupt_event,
                )

                if result == 0:  # Successfully reached LNP
                    await _brake_and_pause(4.0)
                    await navigation_state.update_status(
                        "Reached LNP. Pausing for initial ping.", "success"
                    )
                    ping_success, _, _ = await execute_ping()

                    if ping_success:
                        fresh_state = await navigation_state.get_snapshot()
                        if fresh_state.session:
                            session = fresh_state.session
                            session.phase = SearchPhase.CONCENTRIC_SEARCH
                            session.previous_phase = SearchPhase.TRANSIT_TO_LNP

                            radius = (
                                session.search_area.radius_max_m
                                if session.search_area
                                else 100.0
                            )
                            session.phase_2_waypoints = _generate_equilateral_triangle(
                                session.lnp, min(radius, 200.0)
                            )
                            session.phase_2_index = 0
                            await navigation_state.update_session(session)

                elif result == 2:  # Manual Ping Interrupted AI
                    logger.info(
                        "Phase 1 interrupted by manual ping. Data logged. Resuming to LNP."
                    )
                    interrupt_event.clear()

            # ==========================================
            # PHASE 2: Concentric Search (Equilateral Triangle)
            # ==========================================
            elif current_phase == SearchPhase.CONCENTRIC_SEARCH:
                if session.phase_2_index >= len(session.phase_2_waypoints):
                    logger.info("Phase 2 complete. Transitioning to Phase 3.")
                    session.phase = SearchPhase.GRADIENT_ASCENT
                    session.previous_phase = SearchPhase.CONCENTRIC_SEARCH
                    await navigation_state.update_session(session)
                    continue

                target = session.phase_2_waypoints[session.phase_2_index]
                session.current_target = NavigationTarget(
                    position=target,
                    description=f"Triangle Pt {session.phase_2_index + 1}",
                    arrival_threshold_m=ARRIVAL_BUFFER_M,
                )
                await navigation_state.update_session(session)

                logger.info(
                    f"Phase 2: Traveling to Triangle Pt {session.phase_2_index + 1}."
                )
                result = await auto_drive_vision.travel_vision(
                    target.x,
                    target.y,
                    arrival_threshold=ARRIVAL_BUFFER_M,
                    interrupt_event=interrupt_event,
                )

                if result == 0:
                    await _brake_and_pause(4.0)
                    await navigation_state.update_status(
                        f"Reached Triangle Pt {session.phase_2_index + 1}.", "info"
                    )
                    await execute_ping()

                    fresh_state = await navigation_state.get_snapshot()
                    if fresh_state.session:
                        session = fresh_state.session
                        session.phase_2_index += 1
                        await navigation_state.update_session(session)

                elif result == 2:
                    logger.info(
                        "Phase 2 interrupted by ping. Ignored for Phase 2 navigation. Resuming."
                    )
                    interrupt_event.clear()

            # ==========================================
            # PHASE 3: Gradient Ascent
            # ==========================================
            elif current_phase == SearchPhase.GRADIENT_ASCENT:
                # Flag check: Triggered if driver did manual pings while manual control was active
                if session.phase_3_recalc_required:
                    logger.info(
                        "Phase 3 AI Resume triggered. Braking and recalculating..."
                    )
                    await navigation_state.update_status(
                        "Recalculating intersection waypoints based on manual pings.",
                        "info",
                    )
                    await _brake_and_pause(4.0)
                    session.phase_3_recalc_required = False
                    await navigation_state.update_session(session)

                target = _calculate_intersection_waypoint(session.ping_history)
                session.current_target = NavigationTarget(
                    position=target,
                    description="Calculated Intersection",
                    arrival_threshold_m=ARRIVAL_BUFFER_M,
                )
                await navigation_state.update_session(session)

                logger.info("Phase 3: Traveling to calculated intersection.")
                result = await auto_drive_vision.travel_vision(
                    target.x,
                    target.y,
                    arrival_threshold=ARRIVAL_BUFFER_M,
                    interrupt_event=interrupt_event,
                )

                if result == 0 or result == 2:
                    if result == 2:
                        await navigation_state.update_status(
                            "Manual ping triggered. Braking to evaluate.", "info"
                        )
                        interrupt_event.clear()

                    # Both AI arrival and Manual AI Ping trigger the 4 second pause and a ping command
                    await _brake_and_pause(4.0)
                    await execute_ping()

                    fresh_state = await navigation_state.get_snapshot()
                    if fresh_state.session and fresh_state.session.ping_history:
                        session = fresh_state.session
                        if (
                            session.ping_history[-1].signal_category
                            == DistanceCategory.STRONG
                        ):
                            logger.info(
                                "STRONG signal detected! Transitioning to Phase 4 (Tight Spiral)."
                            )
                            await navigation_state.update_status(
                                "STRONG signal found. Initiating Archimedes Spiral.",
                                "success",
                            )
                            session.phase = SearchPhase.TIGHT_SPIRAL
                            session.previous_phase = SearchPhase.GRADIENT_ASCENT
                            session.phase_4_anchor = session.ping_history[
                                -1
                            ].rover_position
                            await navigation_state.update_session(session)

            # ==========================================
            # PHASE 4: Archimedes Spiral (50m bounds)
            # ==========================================
            elif current_phase == SearchPhase.TIGHT_SPIRAL:
                anchor = session.phase_4_anchor
                if not anchor:
                    logger.error(
                        "Phase 4 error: No anchor point defined. Reverting to Phase 3."
                    )
                    session.phase = SearchPhase.GRADIENT_ASCENT
                    await navigation_state.update_session(session)
                    continue

                # Bulletproof Math Check: Calculate Euclidean distance manually
                distance_to_anchor = math.hypot(
                    rover_pos.x - anchor.x, rover_pos.y - anchor.y
                )

                # Resume Check: If driver manually drove away, return to anchor first!
                if distance_to_anchor > ARRIVAL_BUFFER_M:
                    logger.info(
                        "Phase 4: Rover is away from anchor. Returning to anchor point first."
                    )
                    await navigation_state.update_status(
                        "Returning to anchor before restarting spiral.", "info"
                    )
                    session.current_target = NavigationTarget(
                        position=anchor,
                        description="Returning to Anchor",
                        arrival_threshold_m=ARRIVAL_BUFFER_M,
                    )
                    await navigation_state.update_session(session)

                    result = await auto_drive_vision.travel_vision(
                        anchor.x,
                        anchor.y,
                        arrival_threshold=ARRIVAL_BUFFER_M,
                        interrupt_event=interrupt_event,
                    )
                    if result == 0:
                        await _brake_and_pause(4.0)
                    elif result == 2:
                        interrupt_event.clear()  # Ignore manual pings completely
                    continue  # Start the loop over to begin the spiral cleanly

                # Generate spiral and iterate
                spiral_points = _generate_archimedes_spiral(anchor)

                for i, target in enumerate(spiral_points):
                    # Check if autonomy was killed between points
                    state = await navigation_state.get_snapshot()
                    if not state.autonomous_driving:
                        break

                    session.current_target = NavigationTarget(
                        position=target,
                        description=f"Spiral Pt {i + 1}",
                        arrival_threshold_m=ARRIVAL_BUFFER_M,
                    )
                    await navigation_state.update_session(session)

                    result = await auto_drive_vision.travel_vision(
                        target.x,
                        target.y,
                        arrival_threshold=ARRIVAL_BUFFER_M,
                        interrupt_event=interrupt_event,
                    )

                    if result == 0:
                        await _brake_and_pause(4.0)
                        await execute_ping()
                    elif result == 2:
                        # Ignore manual pings completely in Phase 4
                        interrupt_event.clear()

                # If we finish the spiral without stopping, idle
                state = await navigation_state.get_snapshot()
                if state.autonomous_driving:
                    logger.info("Spiral max radius reached. Idling.")
                    await navigation_state.set_autonomous_driving(False)
                    await navigation_state.update_status(
                        "Spiral exhausted. Standing by.", "warning"
                    )

    except asyncio.CancelledError:
        logger.warning("Mission loop cancelled.")


# --- Public Methods ---


async def start_autonomous_loop(force_reset: bool = False) -> None:
    """Turns on the mission commander and telemetry stream."""
    global _mission_task, _telemetry_task
    state = await navigation_state.get_snapshot()

    if force_reset or not state.session:
        # Standard Initialization
        try:
            # Type-cast the raw JSON payload to explicitly satisfy strict Pylance rules
            tss_raw = await tss_client.fetch_json(tss_client.COMMAND_ROVER)
            tss_state = cast(Dict[str, Any], tss_raw)

            lnp_pos = tss_state["imu"]["eva1"]
            rover_pos = Position(
                x=float(tss_state["imu"]["rover"]["posx"]),
                y=float(tss_state["imu"]["rover"]["posy"]),
            )
        except Exception as e:
            logger.error(f"Failed to pull LNP from TSS: {e}")
            return

        new_session = SearchSession(
            session_id=str(uuid.uuid4()),
            lnp=Position(x=float(lnp_pos["posx"]), y=float(lnp_pos["posy"])),
            search_center=rover_pos,
            phase=SearchPhase.TRANSIT_TO_LNP,
            ping_history=[],
        )
        await navigation_state.update_session(new_session)
        await navigation_state.set_autonomous_driving(True)
        await navigation_state.update_status(
            "Autonomous navigation initialized.", "info"
        )

    else:
        # Resume Logic (Phase 3 recalc and Phase 4 anchor handled safely in the mission loop)
        await navigation_state.set_autonomous_driving(True)
        session = state.session
        ui_msg = "Resuming Navigation"

        if session.phase == SearchPhase.TRANSIT_TO_LNP:
            ui_msg = "Resuming: Transit to LNP"
        elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
            ui_msg = "Resuming: Concentric Triangle"
        elif session.phase == SearchPhase.GRADIENT_ASCENT:
            ui_msg = "Resuming: Gradient Ascent"
        elif session.phase == SearchPhase.TIGHT_SPIRAL:
            ui_msg = "Resuming: Tight Spiral"

        await navigation_state.update_status(ui_msg, "info")

    # Spin up threads safely
    if _telemetry_task is None or _telemetry_task.done():
        _telemetry_task = asyncio.create_task(telemetry_monitoring_loop())
    if _mission_task is None or _mission_task.done():
        _mission_task = asyncio.create_task(autonomous_mission_loop())

    logger.info("Autonomous Tasks Started.")


async def stop_autonomous_loop() -> None:
    """Kill Switch."""
    global _mission_task, _telemetry_task

    await navigation_state.set_autonomous_driving(False)

    if _mission_task:
        _mission_task.cancel()
    if _telemetry_task:
        _telemetry_task.cancel()

    await navigation_state.update_status(
        "System Idle. Manual Control Active.", "warning"
    )
    logger.info("Autonomous driving aborted by manual override.")


async def execute_ping() -> Tuple[bool, Optional[float], Optional[DistanceCategory]]:
    """Execute a manual or AI ping, respecting the 20-second cooldown."""
    state = await navigation_state.get_snapshot()
    session = state.session
    if not session:
        return False, None, None

    now = datetime.utcnow()
    if session.ping_history:
        delta = (now - session.ping_history[-1].timestamp).total_seconds()
        if delta < PING_COOLDOWN_S:
            await navigation_state.update_status(
                f"Ping Cooldown: Wait {int(PING_COOLDOWN_S - delta)}s", "warning"
            )
            return False, None, None

    try:
        # 1. Fetch Rover Position from TSS
        tss_raw = await tss_client.fetch_json(tss_client.COMMAND_ROVER)
        tss_state = cast(Dict[str, Any], tss_raw)

        rover_pos = Position(
            x=float(tss_state["imu"]["rover"]["posx"]),
            y=float(tss_state["imu"]["rover"]["posy"]),
            heading=float(tss_state["imu"]["rover"]["yaw"]),
        )

        # 2. Trigger the Ping on the TSS Server
        await asyncio.to_thread(tss_client.send_ltv_ping_normal)

        # 3. Wait for the TSS to process and return the new data
        await asyncio.sleep(1.0)

        # 4. Pull the clean RSSI data from your existing background service!
        if telemetry_service.ltv_data is None:
            logger.warning(
                "Ping failed: telemetry_service.ltv_data is not initialized yet."
            )
            return False, None, None

        ltv_data = await telemetry_service.ltv_data.get_snapshot()
        if ltv_data is None or getattr(ltv_data, "signal", None) is None:
            logger.error("Telemetry service returned empty LTV data after ping.")
            return False, None, None

        rssi = float(ltv_data.signal.strength)

    except Exception as e:
        logger.error(f"Failed to execute ping: {e}")
        return False, None, None

    # Categorize RSSI
    if rssi > 0:
        cat = DistanceCategory.NOT_IN_RANGE
    elif rssi >= -30:
        cat = DistanceCategory.STRONG
    elif rssi >= -67:
        cat = DistanceCategory.MODERATE
    elif rssi >= -80:
        cat = DistanceCategory.WEAK
    else:
        cat = DistanceCategory.VERY_WEAK

    record = PingRecord(
        timestamp=now, rssi=rssi, rover_position=rover_pos, signal_category=cat
    )

    # Must get a fresh session snapshot before modifying
    fresh_state = await navigation_state.get_snapshot()
    if not fresh_state.session:
        return False, None, None

    session = fresh_state.session
    session.ping_history.append(record)
    session.search_area = _calculate_search_area(record)

    # Phase 3 Recalculation Check:
    if (
        not fresh_state.autonomous_driving
        and session.phase == SearchPhase.GRADIENT_ASCENT
    ):
        session.phase_3_recalc_required = True

    await navigation_state.update_session(session)

    logger.info(
        f"Ping Executed at ({rover_pos.x:.1f}, {rover_pos.y:.1f}) -> RSSI: {rssi}"
    )
    return True, rssi, cat


async def request_autonomous_ping() -> Dict[str, str]:
    """Hook called by the router when a manual ping is requested while AI is driving."""
    navigation_state.get_ping_interrupt_event().set()
    return {"status": "Interrupting autonomous loop for manual ping calculation."}


async def telemetry_monitoring_loop() -> None:
    """Background loop to update the UI map track."""
    try:
        while True:
            state = await navigation_state.get_snapshot()
            if not state.autonomous_driving or not state.session:
                await asyncio.sleep(1.0)
                continue

            try:
                # Type-cast the raw JSON payload to explicitly satisfy strict Pylance rules
                tss_raw = await tss_client.fetch_json(tss_client.COMMAND_ROVER)
                tss_state = cast(Dict[str, Any], tss_raw)

                rover_pos = Position(
                    x=float(tss_state["imu"]["rover"]["posx"]),
                    y=float(tss_state["imu"]["rover"]["posy"]),
                    heading=float(tss_state["imu"]["rover"]["yaw"]),
                )
                await navigation_state.update_rover_position(rover_pos)

                fresh_state = await navigation_state.get_snapshot()
                if fresh_state.session:
                    session = fresh_state.session

                    # Bulletproof manual math check to avoid function argument typing errors
                    is_far_enough = True
                    if session.path_history:
                        last_pt = session.path_history[-1]
                        dist = math.hypot(
                            last_pt.x - rover_pos.x, last_pt.y - rover_pos.y
                        )
                        is_far_enough = dist > 2.0

                    if not session.path_history or is_far_enough:
                        session.path_history.append(rover_pos)
                        await navigation_state.update_session(session)

            except Exception as e:
                logger.error(f"Telemetry loop error: {e}")

            await asyncio.sleep(1.0)
    except asyncio.CancelledError:
        pass
