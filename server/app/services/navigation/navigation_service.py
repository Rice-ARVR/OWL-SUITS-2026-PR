import asyncio
import logging
import math
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

# --- NEW IMPORTS FOR ARCHITECTURE SHIFT ---
import app.services.navigation.obstacle_avoidance.auto_drive as auto_drive
import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client
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
LNP_POSITION = Position(x=-600.0, y=-1200.6)
SEARCH_RADIUS_M = 548.7
PING_COOLDOWN_S = 20
GRADIENT_PROJECTION_M = 80.0
SPIRAL_ARM_SPACING_M = 25.0
SPIRAL_MAX_RADIUS_M = 100.0

RSSI_THRESHOLDS = {
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


# --- Autonomy Lifecycle ---


async def start_autonomous_loop(force_reset: bool = False):
    global _telemetry_task, _mission_task

    state = await navigation_state.get_snapshot()

    if state.session is None or force_reset:
        await start_search_session()
        logger.info("New search session initialized.")

    await navigation_state.set_autonomous_driving(True)

    # Spin up the UI telemetry loop
    if _telemetry_task is None or _telemetry_task.done():
        _telemetry_task = asyncio.create_task(telemetry_monitoring_loop())

    # Spin up the high-level mission commander
    if _mission_task is None or _mission_task.done():
        _mission_task = asyncio.create_task(autonomous_mission_loop())

    logger.info("Autonomous Tasks Started.")


async def stop_autonomous_loop():
    global _telemetry_task, _mission_task
    await navigation_state.set_autonomous_driving(False)

    if _telemetry_task and not _telemetry_task.done():
        _telemetry_task.cancel()
    if _mission_task and not _mission_task.done():
        _mission_task.cancel()

    # Slam the brakes to release controls safely to user
    await send_rover_command({"throttle": 0, "steering": 0, "brakes": 1.0})
    logger.info("Autonomous Loop Stopped. User has control.")


# --- Background Tasks ---


async def telemetry_monitoring_loop():
    """Background task running at 10Hz to update frontend state and drop breadcrumbs."""
    while True:
        state = await navigation_state.get_snapshot()
        if not state.autonomous_driving:
            break

        try:
            rover_data = await tss_client.fetch_json(tss_client.COMMAND_ROVER)
            if not rover_data:
                rover_data = {}

            rover_x = rover_data.get("pos_x", 0.0)
            rover_y = rover_data.get("pos_y", 0.0)
            rover_heading = rover_data.get("heading", 0.0)
            lidar_array = rover_data.get("lidar", [1500.0] * 17)

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

            session = state.session
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

            # 3. Target Check: Abort on unreachable waypoint
            if not safe_path:
                await abort_autonomous_mission(
                    "Mission Aborted: Target is unreachable due to surrounding hazard barriers."
                )
                break

            # 4. Traverse the path using auto_drive
            path_success = True
            for i, waypoint in enumerate(safe_path):
                # Update the projected path so the frontend UI line adjusts dynamically
                session.projected_path = safe_path[i:]
                await navigation_state.update_session(session)

                logger.info(
                    f"Delegating to auto_drive for waypoint: ({waypoint.x:.1f}, {waypoint.y:.1f})"
                )

                # Yield control to auto_drive until it arrives or fails
                result = await auto_drive.travel(waypoint.x, waypoint.y)

                # TRIGGER THE HAND-OFF TO MANUAL
                if result != 0:
                    path_success = False
                    break

            if not path_success:
                await abort_autonomous_mission(
                    "Auto_drive failed (stuck or blocked). Control returned to operator."
                )
                break

            # 5. Arrived at the final target! Wait for cooldown, ping, and evaluate next phase.
            await evaluate_phase_and_ping(state)

    except asyncio.CancelledError:
        pass


# --- Mission Logic & Evaluation ---


async def abort_autonomous_mission(reason: str) -> None:
    """Gracefully aborts the mission, cleans up UI state, and stops the rover."""
    logger.error(f"Mission Aborted: {reason}")

    # 1. Scrub the session state so the frontend knows we are done
    state = await navigation_state.get_snapshot()
    if state.session:
        state.session.phase = SearchPhase.IDLE
        state.session.current_target = None
        state.session.projected_path = []
        await navigation_state.update_session(state.session)

    # 2. Hand control back to the operator
    await stop_autonomous_loop()


async def evaluate_phase_and_ping(state: NavigationState):
    """Called when auto_drive successfully reaches a target. Pings and decides next phase."""
    global ring_waypoints, current_ring_index, current_spiral_index

    session = state.session
    rover_pos = state.rover_position
    lidar = state.latest_lidar

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
            await send_rover_command({"throttle": 0, "steering": 0, "brakes": 1.0})
            await asyncio.sleep(wait_time)

    # Execute Ping
    success, rssi, _ = await execute_ping()

    # State Machine Transitions
    if session.phase == SearchPhase.TRANSIT_TO_LNP:
        session.search_center = rover_pos
        await update_search_phase(SearchPhase.CONCENTRIC_SEARCH)
        if success:
            session.best_rssi = rssi
            if ring_waypoints:
                session.current_target = NavigationTarget(
                    position=Position(x=ring_waypoints[0][0], y=ring_waypoints[0][1]),
                    description=f"Ring waypoint 1/{len(ring_waypoints)}",
                    arrival_threshold_m=10.0,
                )
                current_ring_index = 0

    elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
        if success:
            if rssi > session.best_rssi:
                session.best_rssi = rssi
                session.success_vector = calculate_bearing(
                    session.search_center.x,
                    session.search_center.y,
                    rover_pos.x,
                    rover_pos.y,
                )

            if rssi >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
                await update_search_phase(SearchPhase.GRADIENT_ASCENT)
                session.current_target = NavigationTarget(
                    position=get_gradient_waypoint(
                        rover_pos, session.success_vector, session.search_center
                    ),
                    description="Gradient ascent waypoint",
                    arrival_threshold_m=10.0,
                )
            else:
                current_ring_index += 1
                if current_ring_index < len(ring_waypoints):
                    session.current_target = NavigationTarget(
                        position=Position(
                            x=ring_waypoints[current_ring_index][0],
                            y=ring_waypoints[current_ring_index][1],
                        ),
                        description=f"Ring waypoint {current_ring_index + 1}/{len(ring_waypoints)}",
                        arrival_threshold_m=10.0,
                    )
                else:
                    await update_search_phase(SearchPhase.GRADIENT_ASCENT)
                    session.success_vector = 0.0
                    session.current_target = NavigationTarget(
                        position=get_gradient_waypoint(
                            rover_pos, session.success_vector, session.search_center
                        ),
                        description="Gradient ascent waypoint",
                        arrival_threshold_m=10.0,
                    )

    elif session.phase == SearchPhase.GRADIENT_ASCENT:
        if success:
            improved = rssi > session.best_rssi

            # If the signal drops significantly, we are moving the wrong way.
            significant_drop = rssi < (session.best_rssi - 5.0)

            if improved:
                session.best_rssi = rssi
                session.gradient_retries = 0  # Reset counter on success

                prev_x = (
                    session.ping_history[-2].rover_position.x
                    if len(session.ping_history) > 1
                    else rover_pos.x
                )
                prev_y = (
                    session.ping_history[-2].rover_position.y
                    if len(session.ping_history) > 1
                    else rover_pos.y
                )
                session.success_vector = calculate_bearing(
                    prev_x, prev_y, rover_pos.x, rover_pos.y
                )

            if rssi >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
                await update_search_phase(SearchPhase.TIGHT_SPIRAL)
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
        ltv_pos = (
            check_for_ltv_proximity(session.best_rssi, lidar)
            if lidar is not None
            else None
        )
        if ltv_pos or session.best_rssi > -10.0:
            await update_search_phase(SearchPhase.FOUND)
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
    if rssi_value >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
        return DistanceCategory.STRONG
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
        return DistanceCategory.MODERATE
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.WEAK]:
        return DistanceCategory.WEAK
    return DistanceCategory.VERY_WEAK


def generate_initial_rings(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    rings = [
        (150.0, [0, 90, 180, 270]),
        (350.0, [0, 60, 120, 180, 240, 300]),
        (550.0, [30, 90, 150, 210, 270, 330]),
    ]
    waypoints = []
    for radius, angles in rings:
        for angle_deg in angles:
            angle_rad = math.radians(angle_deg)
            waypoints.append(
                (
                    center_x + radius * math.cos(angle_rad),
                    center_y + radius * math.sin(angle_rad),
                )
            )
    return waypoints


def generate_square_spiral(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    return list(
        generate_square_spiral_waypoints(
            center_x, center_y, SPIRAL_ARM_SPACING_M, SPIRAL_MAX_RADIUS_M
        )
    )[1:]


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
    return session


async def update_search_phase(new_phase: SearchPhase) -> None:
    state = await navigation_state.get_snapshot()
    if state.session:
        logger.info(
            f"Phase Transition: {state.session.phase.value} -> {new_phase.value}"
        )
        state.session.phase = new_phase
        await navigation_state.update_session(state.session)


async def execute_ping() -> Tuple[bool, float, DistanceCategory]:
    global last_ping_time
    now = datetime.now()

    # Double check cooldown enforcement
    if last_ping_time and (now - last_ping_time).total_seconds() < PING_COOLDOWN_S:
        return False, 0.0, DistanceCategory.VERY_WEAK

    await asyncio.to_thread(tss_client.send_ltv_ping_normal)
    await asyncio.sleep(1)

    # Safety guard to fix the "None" type error
    if telemetry_service.ltv_data is None:
        logger.warning(
            "Ping failed: telemetry_service.ltv_data is not initialized yet."
        )
        return False, 0.0, DistanceCategory.VERY_WEAK

    ltv_data = await telemetry_service.ltv_data.get_snapshot()

    if ltv_data and ltv_data.signal:
        rssi = ltv_data.signal.strength
        category = categorize_rssi(rssi)
        last_ping_time = datetime.now()

        logger.info(f"Ping successful! RSSI: {rssi} dBm ({category.value})")

        state = await navigation_state.get_snapshot()
        session = state.session
        rover_pos = state.rover_position

        if session is not None and rover_pos is not None:
            session.ping_history.append(
                PingRecord(
                    timestamp=last_ping_time,
                    rssi=rssi,
                    rover_position=rover_pos,
                    signal_category=category,
                )
            )
            await navigation_state.update_session(session)
        return True, rssi, category

    return False, 0.0, DistanceCategory.VERY_WEAK
