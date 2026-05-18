import asyncio
import logging
import math
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

# --- NEW IMPORTS FOR ARCHITECTURE SHIFT ---
import app.services.navigation.obstacle_avoidance.auto_drive as auto_drive
import app.services.navigation.vision.auto_drive_vision as auto_drive_vision
import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client
from app.core.config import settings
from app.models.nav_model import (
    DistanceCategory,
    Hazard,
    LidarReading,
    LidarScan,
    NavigationState,
    NavigationStateData,
    NavigationTarget,
    PingRecord,
    Position,
    SearchArea,
    SearchPhase,
    SearchSession,
)
from app.services.navigation.pathfinding import (
    expand_polygon,
    find_path_around_hazards,
    point_in_polygon,
)
from app.services.navigation.spatial_math import (
    calculate_bearing,
    calculate_distance,
    generate_square_spiral_waypoints,
)
from app.services.rover_control_service import send_rover_command

logger = logging.getLogger(__name__)
logger.propagate = False

# --- Constants ---
LNP_POSITION = Position(x=-5669.80, y=-10074.60)
SEARCH_RADIUS_M = 548.7
TRIANGLE_SEARCH_RADIUS_M = 300.0
PING_COOLDOWN_S = 20
GRADIENT_PROJECTION_M = 80.0
SPIRAL_ARM_SPACING_M = 25.0
SPIRAL_MAX_RADIUS_M = 100.0


async def get_lnp_position() -> Position:
    """Return the Last Nominal Position from telemetry if available."""
    if telemetry_service.ltv_data is None:
        return LNP_POSITION

    x = await telemetry_service.ltv_data.get_location_last_known_x()
    y = await telemetry_service.ltv_data.get_location_last_known_y()
    if x is None or y is None:
        return LNP_POSITION

    return Position(x=x, y=y)


RSSI_THRESHOLDS = {
    DistanceCategory.NOT_IN_RANGE: 1.0,
    DistanceCategory.STRONG: -30.0,
    DistanceCategory.MODERATE: -67.0,
    DistanceCategory.WEAK: -80.0,
    DistanceCategory.VERY_WEAK: -90.0,
}

TIER_2_SENSORS = [1, 2, 3, 13, 14]
TIER_3_SENSORS = [5, 6, 7]

# --- Global State ---
navigation_state = NavigationStateData()
last_ping_time: Optional[datetime] = None
ring_waypoints: List[Tuple[float, float]] = []
current_ring_index: int = 0
current_spiral_index: int = 0

# Track the two concurrent background tasks
_telemetry_task: Optional[asyncio.Task] = None
_mission_task: Optional[asyncio.Task] = None


# --- Travel Algorithm Dispatch ---


async def _travel(
    goal_x: float,
    goal_y: float,
    arrival_threshold: float,
    interrupt_event: Optional[asyncio.Event],
) -> int:
    """Drive to (goal_x, goal_y) using the algorithm selected in config.

    Returns 0 on success, non-zero to hand control back to the operator.
    """
    if settings.NAV_TRAVEL_ALGORITHM == "cv":
        return await auto_drive_vision.travel_vision(
            goal_x, goal_y, arrival_threshold, interrupt_event
        )
    return await auto_drive.travel(goal_x, goal_y, arrival_threshold, interrupt_event)


# --- Autonomy Lifecycle ---


async def start_autonomous_loop(force_reset: bool = False):
    global _telemetry_task, _mission_task, ring_waypoints, current_ring_index

    # Safely fetch and clear the event via the state manager
    interrupt_event = navigation_state.get_ping_interrupt_event()
    interrupt_event.clear()

    state = await navigation_state.get_snapshot()

    if state.session is None or force_reset:
        await start_search_session()
        logger.info("New search session initialized.")
    elif state.session.phase == SearchPhase.IDLE:
        logger.info("Resuming aborted session. Restoring previous phase.")

        # 1. Capture the phase we are restoring
        resumed_phase = state.session.previous_phase or SearchPhase.TRANSIT_TO_LNP
        state.session.phase = resumed_phase

        # 2. Map the enum to a clean, UI-friendly string
        phase_descriptions = {
            SearchPhase.TRANSIT_TO_LNP: "Transit to Last Nominal Position",
            SearchPhase.CONCENTRIC_SEARCH: "Concentric Search",
            SearchPhase.GRADIENT_ASCENT: "Gradient Ascent",
            SearchPhase.TIGHT_SPIRAL: "Tight Spiral",
        }

        # Default to a formatted string if not in the dictionary just in case
        phase_name = phase_descriptions.get(
            resumed_phase, resumed_phase.value.replace("_", " ").title()
        )

        # Conditional wake-up target
        if resumed_phase == SearchPhase.TRANSIT_TO_LNP:
            # Must drive to the actual LNP, not its current spot!
            resume_target = state.session.lnp
            threshold = 50.0
        elif resumed_phase == SearchPhase.CONCENTRIC_SEARCH:
            # Regenerate triangle from LNP in case ring_waypoints was lost across restart.
            ring_waypoints = generate_initial_rings(
                state.session.lnp.x, state.session.lnp.y
            )
            resume_target = Position(
                x=ring_waypoints[current_ring_index][0],
                y=ring_waypoints[current_ring_index][1],
            )
            threshold = 30.0
        else:
            # GRADIENT_ASCENT / TIGHT_SPIRAL: resume from rover's current position.
            resume_target = state.rover_position or state.session.lnp
            threshold = 5.0

            # Flush stale math if the user drove the rover away while paused
            if state.session.path_history and state.rover_position:
                last_auto_pos = state.session.path_history[-1]
                dist_moved = calculate_distance(
                    state.rover_position.x,
                    state.rover_position.y,
                    last_auto_pos.x,
                    last_auto_pos.y,
                )
                # If user moved it more than 15 meters, force the AI to recalculate bearings
                if dist_moved > 15.0 and resumed_phase in [
                    SearchPhase.GRADIENT_ASCENT,
                    SearchPhase.TIGHT_SPIRAL,
                ]:
                    state.session.success_vector = 0.0  # reset bearing
                    state.session.best_rssi = float("-inf")  # force a fresh evaluation

        # 3. Inject the dynamic phase name AND the correct targets
        state.session.current_target = NavigationTarget(
            position=resume_target,
            description=f"Resuming: {phase_name}",
            arrival_threshold_m=threshold,
        )
        await navigation_state.update_session(state.session)

    await navigation_state.set_autonomous_driving(True)

    # Let the UI know autonomy has taken over
    await navigation_state.update_status("Autonomous navigation engaged.", "info")

    # Spin up the UI telemetry loop
    if _telemetry_task is None or _telemetry_task.done():
        _telemetry_task = asyncio.create_task(telemetry_monitoring_loop())

    # Spin up the high-level mission commander
    if _mission_task is None or _mission_task.done():
        _mission_task = asyncio.create_task(autonomous_mission_loop())

    logger.info("Autonomous Tasks Started.")


async def stop_autonomous_loop(apply_brakes: bool = True):
    global _telemetry_task, _mission_task
    await navigation_state.set_autonomous_driving(False)

    # Identify the caller so we never await a task from within itself (deadlock).
    # abort_autonomous_mission calls stop from inside _mission_task, so self-await
    # must be skipped — the task exits on its own once control returns.
    current_task = asyncio.current_task()

    if _telemetry_task and not _telemetry_task.done():
        _telemetry_task.cancel()
        if _telemetry_task is not current_task:
            try:
                await _telemetry_task
            except Exception:
                pass

    if _mission_task and not _mission_task.done():
        _mission_task.cancel()
        if _mission_task is not current_task:
            try:
                await _mission_task
            except Exception:
                pass

    # Slam the brakes to release controls safely to user (if not overridden)
    if apply_brakes:
        await send_rover_command({"throttle": 0, "steering": 0, "brakes": 1.0})

    # Clear any stale projected path left over from mid-mission stops
    state = await navigation_state.get_snapshot()
    if state.session and state.session.projected_path:
        state.session.projected_path = []
        await navigation_state.update_session(state.session)

    # Wipe any lingering countdowns or AI messages from the UI
    await navigation_state.update_status("System Idle. Manual Control Active.", "info")

    logger.info("Autonomous Loop Stopped. User has control.")


# --- Background Tasks ---


async def telemetry_monitoring_loop():
    """Background task running at 10Hz to update frontend state and drop breadcrumbs."""
    while True:
        state = await navigation_state.get_snapshot()
        if not state.autonomous_driving:
            break

        try:
            if telemetry_service.rover_data is None:
                await asyncio.sleep(0.1)
                continue

            snap = await telemetry_service.rover_data.get_snapshot()
            if not snap or not snap.pr_telemetry:
                await asyncio.sleep(0.1)
                continue

            tel = snap.pr_telemetry

            rover_x = tel.rover_pos_x
            rover_y = tel.rover_pos_y
            rover_heading = tel.heading
            lidar_array = tel.lidar if hasattr(tel, "lidar") else [1500.0] * 17

            position = Position(x=rover_x, y=rover_y, heading=rover_heading)
            await navigation_state.update_rover_position(position)

            readings = [
                LidarReading(index=i, distance_cm=dist, is_obstacle=dist < 1000)
                for i, dist in enumerate(lidar_array)
            ]
            lidar_scan = LidarScan(
                readings=readings,
                clear_ahead=all(
                    r.distance_cm > 200 for r in readings if r.index in TIER_2_SENSORS
                ),
                closest_obstacle_distance=min(
                    (r.distance_cm for r in readings), default=float("inf")
                ),
            )
            await navigation_state.update_lidar(lidar_scan)

            fresh_state = await navigation_state.get_snapshot()
            session = fresh_state.session

            if session is not None:
                if not session.path_history:
                    session.path_history.append(position)
                else:
                    dist = calculate_distance(
                        session.path_history[-1].x,
                        session.path_history[-1].y,
                        position.x,
                        position.y,
                    )
                    if dist >= 2.0:
                        session.path_history.append(position)
                await navigation_state.update_session(session)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Telemetry Fetch Error: {e}")

        await asyncio.sleep(0.1)


async def autonomous_mission_loop():
    """The Mission Commander. Determines path, delegates to auto_drive, handles pings."""
    try:
        while True:
            state = await navigation_state.get_snapshot()
            session = state.session

            if not state.autonomous_driving or session is None:
                break

            if session.phase == SearchPhase.FOUND:
                logger.info("LTV FOUND condition met! Ending autonomous mission.")
                # Flag success to the UI before stopping
                await navigation_state.update_status(
                    "LTV Located! Mission accomplished.", "success"
                )
                await stop_autonomous_loop()
                break

            target = session.current_target
            rover_pos = state.rover_position

            if target is None or rover_pos is None:
                await asyncio.sleep(1)
                continue

            # 1. Waypoint Validation: Ensure that waypoints are not generated in hazards
            safe_target_pos = validate_and_nudge_waypoint(
                target.position, state.hazards, rover_pos
            )
            target.position = safe_target_pos

            # 2. Pathfinding: Avoid hazards and generate safe waypoints
            # Offload math to separate worker thread
            safe_path = await asyncio.to_thread(
                find_path_around_hazards, rover_pos, target.position, state.hazards
            )

            # 3. Target Check: Attempt smart skipping if target is unreachable
            if not safe_path:
                can_skip = await handle_unreachable_target(state)

                if can_skip:
                    logger.info(
                        "Successfully skipped unreachable target. Restarting loop."
                    )
                    continue  # Jump back to the start of the while loop with the new target
                else:
                    await abort_autonomous_mission(
                        "Mission Aborted: Target is unreachable and no valid skip path exists."
                    )
                    break

            # 4. Traverse the path using auto_drive
            path_success = True
            ping_interrupted = False
            for i, waypoint in enumerate(safe_path):
                # Update the projected path so the frontend UI line adjusts dynamically
                # Fetch fresh state to prevent overwriting telemetry
                fresh_state = await navigation_state.get_snapshot()
                if fresh_state.session:
                    fresh_state.session.projected_path = safe_path[i:]
                    await navigation_state.update_session(fresh_state.session)

                logger.info(
                    f"Delegating to auto_drive for waypoint: ({waypoint.x:.1f}, {waypoint.y:.1f})"
                )

                # Ensure the event is clear before starting the trip
                interrupt_event = navigation_state.get_ping_interrupt_event()
                interrupt_event.clear()

                # Yield control to the configured driver until it arrives or fails
                result = await _travel(
                    waypoint.x,
                    waypoint.y,
                    target.arrival_threshold_m,
                    interrupt_event,  # Pass the fetched event here
                )

                # TRIGGER THE MANUAL PING INTERRUPT
                if result == 2:
                    await navigation_state.update_status(
                        "Brakes active. Executing ping and recalculating next waypoint...",
                        "info",
                    )
                    await evaluate_phase_and_ping()
                    await navigation_state.update_status(
                        "Recalculation complete. Resuming autonomous navigation to next waypoint.",
                        "success",
                    )
                    ping_interrupted = True
                    break  # Exit for-loop; while-loop re-pathfinds to new current_target

                # TRIGGER THE HAND-OFF TO MANUAL (Failure)
                if result != 0:
                    path_success = False
                    break
                else:
                    # confirm Success upon arrival
                    if (
                        session.phase == SearchPhase.TRANSIT_TO_LNP
                        and i == len(safe_path) - 1
                    ):
                        await navigation_state.update_status(
                            "Success: Arrived at LTV Last Nominal Position. Rover fully stopped.",
                            "success",
                        )
                    else:
                        await navigation_state.update_status(
                            "Success: Waypoint reached. Rover paused.", "success"
                        )

            if not path_success:
                await abort_autonomous_mission(
                    "Auto_drive failed (stuck or blocked). Control returned to operator."
                )
                break

            # 5. Arrived at the final target — ping and evaluate next phase.
            # Skipped if a mid-path ping interrupt already called evaluate_phase_and_ping.
            if not ping_interrupted:
                await evaluate_phase_and_ping()

    except asyncio.CancelledError:
        pass


# --- Mission Logic & Evaluation ---


async def _get_current_rover_position() -> Optional[Position]:
    """Read rover position directly from TSS telemetry and sync to navigation state.

    Always bypasses the navigation_state cache so callers get the freshest
    possible coordinates regardless of how long the telemetry loop has been
    idle (e.g. during a ping cooldown wait or before autonomy starts).
    """
    if telemetry_service.rover_data is None:
        return None
    try:
        snap = await telemetry_service.rover_data.get_snapshot()
        if snap and snap.pr_telemetry:
            tel = snap.pr_telemetry
            pos = Position(x=tel.rover_pos_x, y=tel.rover_pos_y, heading=tel.heading)
            await navigation_state.update_rover_position(pos)
            return pos
    except Exception as e:
        logger.error(f"Failed to fetch rover position from TSS: {e}")
    return None


async def abort_autonomous_mission(reason: str) -> None:
    """Gracefully aborts the mission, cleans up UI state, and stops the rover."""
    logger.error(f"Mission Aborted: {reason}")

    # Push the critical alert to the frontend
    await navigation_state.update_status(reason, "critical")

    # 1. Scrub the session state so the frontend knows we are done
    state = await navigation_state.get_snapshot()
    if state.session:
        # Save the current phase to memory before scrubbing
        state.session.previous_phase = state.session.phase

        state.session.phase = SearchPhase.IDLE
        state.session.current_target = None
        state.session.projected_path = []
        await navigation_state.update_session(state.session)

    # 2. Hand control back to the operator
    await stop_autonomous_loop()


async def handle_unreachable_target(state: NavigationState) -> bool:
    """
    Attempts to skip an unreachable target based on the current search phase.
    This provides a resilient "smart skipping" mechanism instead of a brittle hard-abort.

    Returns:
        True: If the rover successfully skipped the blocked target and re-routed.
        False: If the target cannot be skipped (critical path) and the mission MUST abort.
    """
    # Pull in the global trackers for our search patterns
    global ring_waypoints, current_ring_index, current_spiral_index

    # Extract session and rover position from the current state snapshot
    session = state.session
    rover_pos = state.rover_position

    # --- SAFETY CHECK: Guard against missing data ---
    # Because state.session and state.rover_position are marked as Optional in our
    # Pydantic models, they can be None if the telemetry loop hasn't initialized
    # or the session was dropped. We must catch this before trying to access attributes
    # like session.phase or rover_pos.x to prevent crashes.
    if session is None or rover_pos is None:
        logger.error(
            "Cannot handle unreachable target: session or rover_position is None."
        )
        # Returning False triggers the graceful abort sequence in the mission loop
        return False

    logger.warning(
        f"Target unreachable in phase {session.phase.value}. Attempting reroute..."
    )

    # Notify driver that the rover is calculating a detour
    await navigation_state.update_status(
        f"Target blocked. Rerouting in phase: {session.phase.value}...", "warning"
    )

    # --- PHASE: TRANSIT TO LNP (Last Nominal Position) ---
    if session.phase == SearchPhase.TRANSIT_TO_LNP:
        # The LNP is our primary initial destination. If the LNP itself is entirely
        # walled off by hazards, the overarching mission is impossible to start.
        # We cannot "skip" this, so we must return False to abort and ask for human help.
        return False

    # --- PHASE: CONCENTRIC SEARCH (Triangle) ---
    elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
        # All 3 triangle waypoints must be visited for triangulation; do not skip.
        return False

    # --- PHASE: GRADIENT ASCENT (Following the Signal) ---
    elif session.phase == SearchPhase.GRADIENT_ASCENT:
        # In Gradient Ascent, a blocked path is treated identically to a "bad signal".
        # If we can't drive in this direction, we increment our retry counter and
        # rotate our search vector by 45 degrees to try a new path.
        session.gradient_retries += 1
        session.success_vector += 45.0

        # --- LOCAL MINIMUM TRAP PREVENTER ---
        # 8 retries * 45 degrees = 360 degrees. If we have spun in a complete circle
        # and every path is blocked, the rover is trapped in a "cage" of hazards.
        if session.gradient_retries >= 8:
            return False  # Return False to trigger a manual operator abort

        # If we aren't trapped yet, generate the new target along the rotated vector
        session.current_target = NavigationTarget(
            position=get_gradient_waypoint(
                rover_pos, session.success_vector, session.search_center
            ),
            description="Gradient ascent reroute",
            arrival_threshold_m=10.0,
        )
        await navigation_state.update_session(session)
        return True

    # --- PHASE: TIGHT SPIRAL (The Kill-Box) ---
    elif session.phase == SearchPhase.TIGHT_SPIRAL:
        # Re-generate the mathematical spiral based on the LNP center
        spiral_points = generate_square_spiral(
            session.search_center.x, session.search_center.y
        )

        # Increment to skip the blocked spiral point
        current_spiral_index += 1

        if spiral_points and current_spiral_index < len(spiral_points):
            # Target the next point in the spiral sequence
            session.current_target = NavigationTarget(
                position=Position(
                    x=spiral_points[current_spiral_index][0],
                    y=spiral_points[current_spiral_index][1],
                ),
                description=f"Spiral waypoint {current_spiral_index}",
                arrival_threshold_m=5.0,  # tighter arrival threshold for spiral
            )
            await navigation_state.update_session(session)
            return True

        # If we have exhausted all points in the generated spiral and haven't found the LTV,
        # we have completely failed the search mission. Abort to human control.
        return False

    # Default fallback: if somehow a phase is unmatched, safely abort.
    return False


async def evaluate_phase_and_ping():
    """Called when auto_drive successfully reaches a target. Pings and decides next phase."""
    global ring_waypoints, current_ring_index, current_spiral_index

    # 1. Grab FRESH state immediately after arriving
    state = await navigation_state.get_snapshot()
    session = state.session
    lidar = state.latest_lidar
    rover_pos = await _get_current_rover_position()

    if session is None or rover_pos is None:
        return

    # Apply brakes and wait for ping cooldown if necessary
    global last_ping_time
    now = datetime.now()
    if last_ping_time:
        elapsed = (now - last_ping_time).total_seconds()
        if elapsed < PING_COOLDOWN_S:
            wait_time = PING_COOLDOWN_S - elapsed
            logger.info(
                f"Holding position. Waiting {wait_time:.1f}s for ping cooldown..."
            )

            # 1. Apply brakes immediately so the rover parks safely
            await send_rover_command({"throttle": 0, "steering": 0, "brakes": 1.0})

            # 2. LIVE COUNTDOWN TO FRONTEND
            while wait_time > 0:
                # Update the UI every second with the ticking clock
                await navigation_state.update_status(
                    f"Waypoint reached. Recharging sensor... Ping in {int(wait_time)}s",
                    "info",
                )

                # Sleep in 1-second chunks (or whatever fractional time is left)
                sleep_chunk = min(1.0, wait_time)
                await asyncio.sleep(sleep_chunk)
                wait_time -= sleep_chunk

    # Execute Ping
    success, rssi, category = await execute_ping()

    # 2. execute_ping() modified the global session (added a ping to history).
    # We MUST fetch a fresh snapshot and refresh our locals!
    state = await navigation_state.get_snapshot()
    session = state.session
    lidar = state.latest_lidar
    rover_pos = await _get_current_rover_position()

    if session is None or rover_pos is None:
        return

    if success:
        # notify user ping is done
        await navigation_state.update_status(
            f"Ping Executed automatically. RSSI: {rssi} dBm", "info"
        )

    # State Machine Transitions
    if session.phase == SearchPhase.TRANSIT_TO_LNP:
        session.search_center = session.lnp
        session.phase = SearchPhase.CONCENTRIC_SEARCH
        ring_waypoints = generate_initial_rings(session.lnp.x, session.lnp.y)
        if success and rssi < 0:
            session.best_rssi = rssi
        if ring_waypoints:
            current_ring_index = 0
            session.current_target = NavigationTarget(
                position=Position(x=ring_waypoints[0][0], y=ring_waypoints[0][1]),
                description=f"Triangle waypoint 1/{len(ring_waypoints)}",
                arrival_threshold_m=30.0,
            )

    elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
        if success:
            if category == DistanceCategory.NOT_IN_RANGE:
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=0.0, radius_max_m=0.0
                )
            elif rssi < 0 and rssi > session.best_rssi:
                session.best_rssi = rssi
                r_min, r_max = get_distance_range(category)
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=r_min, radius_max_m=r_max
                )
                await navigation_state.update_status(
                    f"Stronger signal detected ({rssi} dBm). Recalculating LTV search area.",
                    "success",
                )

        if success:
            current_ring_index += 1
            if current_ring_index < len(ring_waypoints):
                session.current_target = NavigationTarget(
                    position=Position(
                        x=ring_waypoints[current_ring_index][0],
                        y=ring_waypoints[current_ring_index][1],
                    ),
                    description=f"Triangle waypoint {current_ring_index + 1}/{len(ring_waypoints)}",
                    arrival_threshold_m=30.0,
                )
            else:
                # All 3 triangle waypoints visited — triangulate LTV direction
                session.phase = SearchPhase.GRADIENT_ASCENT
                concentric_pings = session.ping_history[-len(ring_waypoints):]
                session.success_vector = triangulate_ltv_direction(
                    concentric_pings, session.search_center
                )
                await navigation_state.update_status(
                    "Triangle scan complete. Triangulating LTV direction for gradient ascent.",
                    "info",
                )
                session.current_target = NavigationTarget(
                    position=get_gradient_waypoint(
                        rover_pos, session.success_vector, session.search_center
                    ),
                    description="Gradient ascent waypoint",
                    arrival_threshold_m=10.0,
                )

    elif session.phase == SearchPhase.GRADIENT_ASCENT:
        if success:
            # Must be a valid negative number to be an improvement
            improved = (rssi < 0) and (rssi > session.best_rssi)

            # If the signal drops significantly, we are moving the wrong way.
            significant_drop = (rssi < session.best_rssi - 5.0) or (
                category == DistanceCategory.NOT_IN_RANGE
            )

            if category == DistanceCategory.NOT_IN_RANGE:
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=0.0, radius_max_m=0.0
                )

            if improved:
                session.best_rssi = rssi
                session.gradient_retries = 0  # Reset counter on success

                r_min, r_max = get_distance_range(category)
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=r_min, radius_max_m=r_max
                )

                # search area updated message
                await navigation_state.update_status(
                    f"Stronger signal detected ({rssi} dBm). Recalculating LTV search area.",
                    "success",
                )

                if len(session.ping_history) >= 2:
                    prev_x = session.ping_history[-2].rover_position.x
                    prev_y = session.ping_history[-2].rover_position.y
                else:
                    prev_x = rover_pos.x
                    prev_y = rover_pos.y

                session.success_vector = calculate_bearing(
                    prev_x, prev_y, rover_pos.x, rover_pos.y
                )

            if rssi >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
                session.phase = SearchPhase.TIGHT_SPIRAL
                current_spiral_index = 0
                spiral_points = generate_square_spiral(
                    session.search_center.x, session.search_center.y
                )
                if spiral_points and current_spiral_index < len(spiral_points):
                    session.current_target = NavigationTarget(
                        position=Position(
                            x=spiral_points[current_spiral_index][0],
                            y=spiral_points[current_spiral_index][1],
                        ),
                        description=f"Spiral waypoint {current_spiral_index}",
                        arrival_threshold_m=5.0,
                    )
            else:
                if not improved:
                    if significant_drop:
                        await abort_autonomous_mission(
                            "Gradient Ascent aborted: Signal strength dropped significantly (wrong direction)."
                        )
                        return

                    session.gradient_retries += 1
                    session.success_vector += 45.0

                    # --- Sweep Limit / Local Minimum Trap ---
                    if session.gradient_retries >= 8:
                        await abort_autonomous_mission(
                            "Gradient Ascent stalled. Trapped in a local signal minimum."
                        )
                        return  # Exit the evaluation early

                # Determine the next projection based on the (potentially nudged) vector
                next_target_pos = get_gradient_waypoint(
                    rover_pos, session.success_vector, session.search_center
                )

                # --- Distance Cap Check ---
                # Check if get_gradient_waypoint capped us at the SEARCH_RADIUS_M edge
                dist_to_center = calculate_distance(
                    session.search_center.x,
                    session.search_center.y,
                    next_target_pos.x,
                    next_target_pos.y,
                )

                if dist_to_center >= SEARCH_RADIUS_M and not improved:
                    await abort_autonomous_mission(
                        "Gradient Ascent reached maximum search radius without finding a strong signal."
                    )
                    return

                session.current_target = NavigationTarget(
                    position=next_target_pos,
                    description="Gradient ascent waypoint",
                    arrival_threshold_m=10.0,
                )

    elif session.phase == SearchPhase.TIGHT_SPIRAL:
        found_ltv = False

        # 1. Vision Check (if CV is enabled)
        if settings.NAV_TRAVEL_ALGORITHM == "cv":
            # Safely fetch the latest CV detections from state
            cv_detections = getattr(state, "latest_cv_detections", [])
            for det in cv_detections:
                label = det.label if hasattr(det, "label") else det.get("label", "")
                if label == "Lunar Terrain Vehicle":
                    found_ltv = True
                    logger.info("LTV Found via Computer Vision!")
                    break

        # 2. Lidar/RSSI Check (Fallback or primary if not CV)
        if not found_ltv:
            ltv_pos = (
                check_for_ltv_proximity(session.best_rssi, lidar)
                if lidar is not None
                else None
            )
            if ltv_pos or session.best_rssi > -10.0:
                found_ltv = True
                logger.info("LTV Found via Lidar / RSSI proximity!")

        # 3. Transition based on findings
        if found_ltv:
            session.phase = SearchPhase.FOUND
            session.current_target = None
        else:
            spiral_points = generate_square_spiral(
                session.search_center.x, session.search_center.y
            )
            if spiral_points:
                current_spiral_index += 1
                if current_spiral_index < len(spiral_points):
                    session.current_target = NavigationTarget(
                        position=Position(
                            x=spiral_points[current_spiral_index][0],
                            y=spiral_points[current_spiral_index][1],
                        ),
                        description=f"Spiral waypoint {current_spiral_index}",
                        arrival_threshold_m=5.0,
                    )

    await navigation_state.update_session(session)


# --- Utility Functions ---


def validate_and_nudge_waypoint(
    target_pos: Position, hazards: List[Hazard], rover_pos: Position
) -> Position:
    """
    Checks if a target is inside a hazard and nudges it to a safe distance.
    It does this by pulling the target back along the approach vector.
    """
    if not hazards:
        return target_pos

    OFFSET_M = 15.0
    expanded_polygons = []
    for h in hazards:
        raw_poly = [(p.x, p.y) for p in h.points]
        expanded_polygons.append(expand_polygon(raw_poly, OFFSET_M))

    target_pt = (target_pos.x, target_pos.y)

    for poly in expanded_polygons:
        if point_in_polygon(target_pt, poly):
            logger.warning(
                "Safety Nudge: Generated waypoint is inside a hazard buffer. Nudging..."
            )

            # Pull the target back toward the rover until it is safely outside the polygon
            dx = target_pos.x - rover_pos.x
            dy = target_pos.y - rover_pos.y
            dist = math.hypot(dx, dy)

            if dist == 0:
                return rover_pos

            step_size = 2.0
            current_dist = dist

            while current_dist > 0:
                current_dist -= step_size
                test_pt = (
                    rover_pos.x + (dx / dist) * current_dist,
                    rover_pos.y + (dy / dist) * current_dist,
                )
                if not point_in_polygon(test_pt, poly):
                    return Position(x=test_pt[0], y=test_pt[1])

            # Fallback if the rover itself is somehow inside the buffer
            return rover_pos

    return target_pos


def categorize_rssi(rssi_value: float) -> DistanceCategory:
    if rssi_value > 0:
        return DistanceCategory.NOT_IN_RANGE
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
        return DistanceCategory.STRONG
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
        return DistanceCategory.MODERATE
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.WEAK]:
        return DistanceCategory.WEAK
    return DistanceCategory.VERY_WEAK


def get_distance_range(category: DistanceCategory) -> Tuple[float, float]:
    """Translates a signal category into a minimum and maximum distance radius in meters."""
    ranges = {
        DistanceCategory.STRONG: (0.0, 100.0),
        DistanceCategory.MODERATE: (100.0, 462.0),
        DistanceCategory.WEAK: (462.0, 1200.0),
        DistanceCategory.VERY_WEAK: (
            1200.0,
            2000.0,
        ),  # 2000 acts as an arbitrary outer bound
        DistanceCategory.NOT_IN_RANGE: (0.0, 0.0),
    }
    return ranges[category]


def generate_initial_rings(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    """Generate 3 equilateral triangle waypoints for the concentric search phase."""
    return [
        (
            center_x + TRIANGLE_SEARCH_RADIUS_M * math.cos(math.radians(angle)),
            center_y + TRIANGLE_SEARCH_RADIUS_M * math.sin(math.radians(angle)),
        )
        for angle in [0, 120, 240]
    ]


def generate_square_spiral(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    return list(
        generate_square_spiral_waypoints(
            center_x, center_y, SPIRAL_ARM_SPACING_M, SPIRAL_MAX_RADIUS_M
        )
    )[1:]


def triangulate_ltv_direction(
    ping_records: List[PingRecord], search_center: Position
) -> float:
    """Estimate the bearing toward the LTV using a weighted centroid of the 3 triangle pings.

    Converts each RSSI (dBm) to a linear power weight (mW) so that the position
    with the strongest signal pulls the centroid toward the LTV.
    Falls back to North (0.0°) when no valid readings exist.
    """
    valid = [p for p in ping_records if p.rssi < 0]
    if not valid:
        return 0.0

    weights = [10 ** (p.rssi / 10) for p in valid]
    total = sum(weights)
    est_x = sum(w * p.rover_position.x for w, p in zip(weights, valid)) / total
    est_y = sum(w * p.rover_position.y for w, p in zip(weights, valid)) / total

    return calculate_bearing(search_center.x, search_center.y, est_x, est_y)


def check_for_ltv_proximity(
    rssi_value: float, lidar_scan: LidarScan
) -> Optional[Tuple[float, float]]:
    if rssi_value > -20.0:
        tier3_readings = [r for r in lidar_scan.readings if r.index in TIER_3_SENSORS]
        if any(r.distance_cm < 200 for r in tier3_readings):
            return (0, 0)
    return None


def get_gradient_waypoint(
    current_position: Position, success_vector: float, search_center: Position
) -> Position:
    angle_rad = math.radians(success_vector)
    new_x, new_y = (
        current_position.x + GRADIENT_PROJECTION_M * math.cos(angle_rad),
        current_position.y + GRADIENT_PROJECTION_M * math.sin(angle_rad),
    )
    center_dist = calculate_distance(search_center.x, search_center.y, new_x, new_y)
    if center_dist > SEARCH_RADIUS_M:
        scale = SEARCH_RADIUS_M / center_dist
        new_x = search_center.x + (new_x - search_center.x) * scale
        new_y = search_center.y + (new_y - search_center.y) * scale
    return Position(x=new_x, y=new_y)


async def start_search_session() -> SearchSession:
    global ring_waypoints, current_ring_index, current_spiral_index
    session_id = str(uuid.uuid4())

    # Pull the real Last Nominal Position from telemetry so we don't transit
    # to the (0, 0) origin when the service starts.
    global LNP_POSITION
    LNP_POSITION = await get_lnp_position()

    session = SearchSession(
        session_id=session_id,
        lnp=LNP_POSITION,
        search_center=LNP_POSITION,
        phase=SearchPhase.TRANSIT_TO_LNP,
        success_vector=0.0,
        ping_history=[],
        path_history=[],
        projected_path=[],
        best_rssi=float("-inf"),
        current_target=NavigationTarget(
            position=LNP_POSITION,
            description="Transit to Last Nominal Position",
            arrival_threshold_m=50.0,
        ),
    )

    ring_waypoints = generate_initial_rings(LNP_POSITION.x, LNP_POSITION.y)
    current_ring_index = 0
    current_spiral_index = 0

    await navigation_state.update_session(session)
    logger.info("Search Session Started. Transit to LNP initiated.")

    # begin Navigation to LNP message
    await navigation_state.update_status(
        "Beginning navigation to LTV Last Nominal Position.", "info"
    )

    return session


async def execute_ping() -> Tuple[bool, float, DistanceCategory]:
    global last_ping_time
    now = datetime.now()

    # Double check cooldown enforcement
    if last_ping_time and (now - last_ping_time).total_seconds() < PING_COOLDOWN_S:
        return False, 0.0, DistanceCategory.VERY_WEAK

    # Guard before sending — ltv_data must exist to read the response
    if telemetry_service.ltv_data is None:
        logger.warning("Ping aborted: telemetry_service.ltv_data is not initialized.")
        return False, 0.0, DistanceCategory.VERY_WEAK

    # Snapshot update timestamp so we know when a fresh poll arrives post-ping
    pre_ping_update_t = await telemetry_service.ltv_data.get_last_updated()

    await asyncio.to_thread(tss_client.send_ltv_ping_normal)

    # Wait for the next telemetry poll to complete (fire-and-forget ping; response
    # arrives in the next fetch_json cycle). Poll every 250 ms with a 5 s hard timeout.
    POLL_INTERVAL_S = 0.25
    PING_WAIT_TIMEOUT_S = 5.0
    deadline = asyncio.get_event_loop().time() + PING_WAIT_TIMEOUT_S
    while True:
        await asyncio.sleep(POLL_INTERVAL_S)
        fresh_t = await telemetry_service.ltv_data.get_last_updated()
        if fresh_t is not None and (
            pre_ping_update_t is None or fresh_t > pre_ping_update_t
        ):
            break
        if asyncio.get_event_loop().time() >= deadline:
            logger.warning("Ping timed out waiting for fresh telemetry poll.")
            return False, 0.0, DistanceCategory.VERY_WEAK

    ltv_data = await telemetry_service.ltv_data.get_snapshot()

    if ltv_data and ltv_data.signal:
        rssi = ltv_data.signal.strength
        category = categorize_rssi(rssi)
        last_ping_time = datetime.now()

        logger.info(f"Ping successful! RSSI: {rssi} dBm ({category.value})")

        state = await navigation_state.get_snapshot()

        # 1. Dormant Session Fix
        if state.session is None:
            logger.info(
                "Manual ping detected with no active session. Initializing dormant session."
            )
            state.session = await start_search_session()
            state.session.phase = SearchPhase.IDLE
            await navigation_state.update_session(state.session)

        session = state.session
        rover_pos = await _get_current_rover_position()

        # Now that we guarantee we have a session AND a position, save the ping.
        if session is not None and rover_pos is not None:
            session.ping_history.append(
                PingRecord(
                    timestamp=last_ping_time,
                    rssi=rssi,
                    rover_position=rover_pos,
                    signal_category=category,
                )
            )

            # If completely out of range, clear the search donut
            if category == DistanceCategory.NOT_IN_RANGE:
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=0.0, radius_max_m=0.0
                )
            # Only update best_rssi if it is a VALID signal (less than 0)
            elif rssi < 0 and rssi > session.best_rssi:
                session.best_rssi = rssi
                r_min, r_max = get_distance_range(category)
                session.search_area = SearchArea(
                    center=rover_pos, radius_min_m=r_min, radius_max_m=r_max
                )

            await navigation_state.update_session(session)

            # Notify user ping is done
            await navigation_state.update_status(
                f"Manual Ping Recorded. RSSI: {rssi} dBm", "info"
            )

        return True, rssi, category

    return False, 0.0, DistanceCategory.VERY_WEAK


async def request_autonomous_ping() -> dict:
    """Handles a manual ping request while the AI is driving."""
    global last_ping_time
    now = datetime.now()

    # Step 2: Check the ping cooldown first
    if last_ping_time:
        elapsed = (now - last_ping_time).total_seconds()
        if elapsed < PING_COOLDOWN_S:
            wait_time = int(PING_COOLDOWN_S - elapsed)
            msg = f"Sensor recharging. Please wait {wait_time}s before pinging again."
            await navigation_state.update_status(msg, "warning")
            return {"success": False, "error": msg}

    # Step 3: Cooldown passed. Send message and trigger brakes via interrupt
    await navigation_state.update_status(
        "Manual ping initiated. Applying brakes...", "info"
    )

    # TRIGGER THE EVENT VIA THE STATE MANAGER
    interrupt_event = navigation_state.get_ping_interrupt_event()
    interrupt_event.set()

    return {"success": True, "message": "Interrupt sequence initiated"}
