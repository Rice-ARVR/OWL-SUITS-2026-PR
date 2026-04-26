import asyncio
import logging
import math
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client
from app.models.nav_model import (
    DistanceCategory,
    LidarReading,
    LidarScan,
    NavigationStateData,
    NavigationTarget,
    PingRecord,
    Position,
    RssiSignalStrength,
    SearchPhase,
    SearchSession,
)
from app.services.navigation.spatial_math import (
    calculate_bearing,
    calculate_distance,
    generate_square_spiral_waypoints,
)
from app.services.rover_control_service import send_rover_command

# --- Setup Logger ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] NAV: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# --- Constants ---
LNP_POSITION = Position(x=-6090.0, y=-10485.6)
SEARCH_RADIUS_M = 548.7
PING_COOLDOWN_S = 20
EMERGENCY_LIDAR_THRESHOLD_CM = 100.0
FRONTAL_LIDAR_THRESHOLD_CM = 300.0
THROTTLE_NORMAL = 30
THROTTLE_SLOW = 10
STEERING_GAIN = 45.0
GRADIENT_PROJECTION_M = 80.0
MIN_WAYPOINT_SPACING_M = 40.0
SPIRAL_ARM_SPACING_M = 25.0
SPIRAL_MAX_RADIUS_M = 100.0

RSSI_THRESHOLDS = {
    DistanceCategory.STRONG: -30.0,
    DistanceCategory.MODERATE: -67.0,
    DistanceCategory.WEAK: -80.0,
    DistanceCategory.VERY_WEAK: -90.0,
}

# LIDAR sensor tiers
TIER_1_SENSORS = [0, 4, 9, 12]  # Emergency
TIER_2_SENSORS = [1, 2, 3, 13, 14]  # Frontal obstacle avoidance
TIER_3_SENSORS = [5, 6, 7]  # Visual ID

# --- Global State ---
navigation_state = NavigationStateData()
last_ping_time: Optional[datetime] = None
ring_waypoints: List[Tuple[float, float]] = []
current_ring_index: int = 0


# --- Utility Functions ---


def calculate_search_radius(max_speed_ms: float, time_elapsed_s: float) -> float:
    return max_speed_ms * time_elapsed_s


def categorize_rssi(rssi_value: float) -> DistanceCategory:
    if rssi_value >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
        return DistanceCategory.STRONG
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
        return DistanceCategory.MODERATE
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.WEAK]:
        return DistanceCategory.WEAK
    else:
        return DistanceCategory.VERY_WEAK


def get_rssi_distance_range(category: DistanceCategory) -> Tuple[float, float]:
    ranges = {
        DistanceCategory.STRONG: (0, 100),
        DistanceCategory.MODERATE: (100, 462),
        DistanceCategory.WEAK: (462, 1200),
        DistanceCategory.VERY_WEAK: (1200, float("inf")),
    }
    return ranges[category]


# --- Waypoint Generation ---


def generate_initial_rings(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    rings = [
        (150.0, [0, 90, 180, 270]),  # Ring 1
        (350.0, [0, 60, 120, 180, 240, 300]),  # Ring 2
        (550.0, [30, 90, 150, 210, 270, 330]),  # Ring 3
    ]
    waypoints = []
    for radius, angles in rings:
        for angle_deg in angles:
            angle_rad = math.radians(angle_deg)
            x = center_x + radius * math.cos(angle_rad)
            y = center_y + radius * math.sin(angle_rad)
            waypoints.append((x, y))
    return waypoints


def generate_square_spiral(
    center_x: float, center_y: float
) -> List[Tuple[float, float]]:
    waypoints = list(
        generate_square_spiral_waypoints(
            center_x, center_y, SPIRAL_ARM_SPACING_M, SPIRAL_MAX_RADIUS_M
        )
    )
    return waypoints[1:]  # Skip center


# --- RSSI & LIDAR Processing ---


def process_rssi_signal(rssi_value: float) -> RssiSignalStrength:
    category = categorize_rssi(rssi_value)
    dist_min, dist_max = get_rssi_distance_range(category)
    return RssiSignalStrength(
        value=rssi_value,
        category=category,
        distance_min=dist_min,
        distance_max=dist_max,
        timestamp=datetime.now(),
    )


def analyze_lidar_priority(
    lidar_array: List[float], rover_position: Position, rover_heading: float
) -> Tuple[bool, Optional[float], bool]:
    readings = [
        LidarReading(index=i, distance_cm=dist, is_obstacle=dist < 1000)
        for i, dist in enumerate(lidar_array)
    ]
    brake_required = False
    steering_adjustment = None
    ltv_detected = False

    tier1_distances = [
        readings[i].distance_cm for i in TIER_1_SENSORS if i < len(readings)
    ]
    if any(dist < EMERGENCY_LIDAR_THRESHOLD_CM for dist in tier1_distances):
        brake_required = True

    if not brake_required:
        tier2_distances = [
            readings[i].distance_cm for i in TIER_2_SENSORS if i < len(readings)
        ]
        min_tier2 = min(tier2_distances) if tier2_distances else float("inf")
        if min_tier2 < FRONTAL_LIDAR_THRESHOLD_CM:
            clearest_idx = TIER_2_SENSORS[tier2_distances.index(max(tier2_distances))]
            sensor_angle = (clearest_idx * 360.0) / 17.0
            error = sensor_angle - 0
            steering_adjustment = max(-1.0, min(1.0, error / STEERING_GAIN))

    tier3_distances = [
        readings[i].distance_cm for i in TIER_3_SENSORS if i < len(readings)
    ]
    if len(tier3_distances) >= 3:
        left, middle, right = tier3_distances[0], tier3_distances[1], tier3_distances[2]
        if middle < left * 0.7 and middle < right * 0.7 and middle < 200:
            ltv_detected = True

    return brake_required, steering_adjustment, ltv_detected


def check_for_ltv_proximity(
    rssi_value: float, lidar_scan: LidarScan
) -> Optional[Tuple[float, float]]:
    if rssi_value > -20.0:
        tier3_readings = [r for r in lidar_scan.readings if r.index in TIER_3_SENSORS]
        if any(r.distance_cm < 200 for r in tier3_readings):
            return (0, 0)  # Placeholder
    return None


# --- Navigation Logic ---


def get_gradient_waypoint(
    current_position: Position, success_vector: float, search_center: Position
) -> Position:
    angle_rad = math.radians(success_vector)
    new_x = current_position.x + GRADIENT_PROJECTION_M * math.cos(angle_rad)
    new_y = current_position.y + GRADIENT_PROJECTION_M * math.sin(angle_rad)

    center_dist = calculate_distance(search_center.x, search_center.y, new_x, new_y)
    if center_dist > SEARCH_RADIUS_M:
        scale = SEARCH_RADIUS_M / center_dist
        new_x = search_center.x + (new_x - search_center.x) * scale
        new_y = search_center.y + (new_y - search_center.y) * scale

    return Position(x=new_x, y=new_y)


def update_success_vector(
    from_position: Position, to_position: Position, improved: bool
) -> float:
    if improved:
        return calculate_bearing(
            from_position.x, from_position.y, to_position.x, to_position.y
        )
    else:
        return (from_position.heading or 0) + 45.0


def has_reached_target(
    rover_x: float, rover_y: float, target: NavigationTarget
) -> bool:
    dist = calculate_distance(rover_x, rover_y, target.position.x, target.position.y)
    return dist <= target.arrival_threshold_m


async def navigate_to_target(
    rover_position: Position,
    target: NavigationTarget,
    lidar_scan: LidarScan,
    phase: SearchPhase,
) -> None:
    bearing_to_target = calculate_bearing(
        rover_position.x, rover_position.y, target.position.x, target.position.y
    )
    error = bearing_to_target - (rover_position.heading or 0)
    error = (error + 180) % 360 - 180

    steering = max(-1.0, min(1.0, error / STEERING_GAIN))

    brake_required, lidar_steering, _ = analyze_lidar_priority(
        [r.distance_cm for r in lidar_scan.readings],
        rover_position,
        rover_position.heading or 0,
    )

    if brake_required:
        throttle, brakes, steering = 0, 1.0, 0
    else:
        throttle = (
            THROTTLE_SLOW if phase == SearchPhase.TIGHT_SPIRAL else THROTTLE_NORMAL
        )
        brakes = 0.0
        if lidar_steering is not None:
            steering = lidar_steering

    await send_rover_command(
        {"throttle": throttle, "steering": steering, "brakes": brakes}
    )


# --- Session Management ---


async def start_search_session() -> SearchSession:
    global ring_waypoints, current_ring_index
    session_id = str(uuid.uuid4())

    session = SearchSession(
        session_id=session_id,
        lnp=LNP_POSITION,
        search_center=LNP_POSITION,
        phase=SearchPhase.TRANSIT_TO_LNP,
        success_vector=0.0,
        ping_history=[],
        best_rssi=float("-inf"),
        current_target=NavigationTarget(
            position=LNP_POSITION,
            description="Transit to Last Nominal Position",
            arrival_threshold_m=50.0,
        ),
    )

    ring_waypoints = generate_initial_rings(LNP_POSITION.x, LNP_POSITION.y)
    current_ring_index = 0

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


# --- Ping Operations ---


async def execute_ping() -> Tuple[bool, float, DistanceCategory]:
    global last_ping_time
    now = datetime.now()

    if last_ping_time and (now - last_ping_time).total_seconds() < PING_COOLDOWN_S:
        return False, 0.0, DistanceCategory.VERY_WEAK

    await asyncio.to_thread(tss_client.send_ltv_ping_normal)
    await asyncio.sleep(1)

    ltv_data = await telemetry_service.ltv_data.get_snapshot()
    if ltv_data and ltv_data.signal:
        rssi = ltv_data.signal.strength
        category = categorize_rssi(rssi)
        last_ping_time = now

        logger.info(f"Ping successful! RSSI: {rssi} dBm ({category.value})")

        state = await navigation_state.get_snapshot()
        if state.session and state.rover_position:
            ping_record = PingRecord(
                timestamp=now,
                rssi=rssi,
                rover_position=state.rover_position,
                signal_category=category,
            )
            state.session.ping_history.append(ping_record)
            await navigation_state.update_session(state.session)

        return True, rssi, category

    return False, 0.0, DistanceCategory.VERY_WEAK


# --- Main Execution ---


async def execute_navigation_step(
    rover_x: float, rover_y: float, rover_heading: float, lidar_array: List[float]
) -> Dict:
    global ring_waypoints, current_ring_index

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

    state = await navigation_state.get_snapshot()
    if not state.session or not state.autonomous_driving:
        return {
            "throttle": 0,
            "steering": 0,
            "brakes": 0,
            "next_target": None,
            "phase": SearchPhase.IDLE.value,
        }

    session = state.session
    target = session.current_target

    if target and has_reached_target(rover_x, rover_y, target):
        logger.info(f"Waypoint Reached: {target.description}")

        if session.phase == SearchPhase.TRANSIT_TO_LNP:
            session.search_center = position
            await update_search_phase(SearchPhase.CONCENTRIC_SEARCH)

            success, rssi, _ = await execute_ping()
            if success:
                session.best_rssi = rssi
                if ring_waypoints:
                    wx, wy = ring_waypoints[0]
                    session.current_target = NavigationTarget(
                        position=Position(x=wx, y=wy),
                        description=f"Ring waypoint 1/{len(ring_waypoints)}",
                        arrival_threshold_m=10.0,
                    )
                    current_ring_index = 0

        elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
            success, rssi, _ = await execute_ping()
            if success:
                if rssi > session.best_rssi:
                    session.best_rssi = rssi
                    session.success_vector = calculate_bearing(
                        session.search_center.x,
                        session.search_center.y,
                        rover_x,
                        rover_y,
                    )

                if rssi >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
                    await update_search_phase(SearchPhase.GRADIENT_ASCENT)
                    new_target_pos = get_gradient_waypoint(
                        position, session.success_vector, session.search_center
                    )
                    session.current_target = NavigationTarget(
                        position=new_target_pos,
                        description="Gradient ascent waypoint",
                        arrival_threshold_m=10.0,
                    )
                else:
                    current_ring_index += 1
                    if current_ring_index < len(ring_waypoints):
                        wx, wy = ring_waypoints[current_ring_index]
                        session.current_target = NavigationTarget(
                            position=Position(x=wx, y=wy),
                            description=f"Ring waypoint {current_ring_index + 1}/{len(ring_waypoints)}",
                            arrival_threshold_m=10.0,
                        )
                    else:
                        await update_search_phase(SearchPhase.GRADIENT_ASCENT)
                        session.success_vector = 0.0
                        new_target_pos = get_gradient_waypoint(
                            position, session.success_vector, session.search_center
                        )
                        session.current_target = NavigationTarget(
                            position=new_target_pos,
                            description="Gradient ascent waypoint",
                            arrival_threshold_m=10.0,
                        )

        elif session.phase == SearchPhase.GRADIENT_ASCENT:
            success, rssi, _ = await execute_ping()
            if success:
                improved = rssi > session.best_rssi
                if improved:
                    session.best_rssi = rssi
                    prev_x = (
                        session.ping_history[-2].rover_position.x
                        if len(session.ping_history) > 1
                        else rover_x
                    )
                    prev_y = (
                        session.ping_history[-2].rover_position.y
                        if len(session.ping_history) > 1
                        else rover_y
                    )
                    session.success_vector = calculate_bearing(
                        prev_x, prev_y, rover_x, rover_y
                    )

                if rssi >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
                    await update_search_phase(SearchPhase.TIGHT_SPIRAL)
                    spiral_points = generate_square_spiral(
                        session.search_center.x, session.search_center.y
                    )
                    if spiral_points:
                        session.current_target = NavigationTarget(
                            position=Position(
                                x=spiral_points[0][0], y=spiral_points[0][1]
                            ),
                            description="Spiral search waypoint",
                            arrival_threshold_m=5.0,
                        )
                else:
                    if not improved:
                        session.success_vector += 45.0
                    new_target_pos = get_gradient_waypoint(
                        position, session.success_vector, session.search_center
                    )
                    session.current_target = NavigationTarget(
                        position=new_target_pos,
                        description="Gradient ascent waypoint",
                        arrival_threshold_m=10.0,
                    )

        elif session.phase == SearchPhase.TIGHT_SPIRAL:
            success, rssi, _ = await execute_ping()

            ltv_pos = check_for_ltv_proximity(session.best_rssi, lidar_scan)
            if ltv_pos or session.best_rssi > -10.0:
                await update_search_phase(SearchPhase.FOUND)
                session.current_target = None
            else:
                spiral_points = generate_square_spiral(
                    session.search_center.x, session.search_center.y
                )
                if spiral_points:
                    session.current_target = NavigationTarget(
                        position=Position(x=spiral_points[0][0], y=spiral_points[0][1]),
                        description="Spiral search waypoint",
                        arrival_threshold_m=5.0,
                    )

        await navigation_state.update_session(session)

    if target:
        await navigate_to_target(position, target, lidar_scan, session.phase)

    return {
        "throttle": THROTTLE_NORMAL
        if session.phase != SearchPhase.TIGHT_SPIRAL
        else THROTTLE_SLOW,
        "steering": 0,
        "brakes": 0,
        "next_target": target.model_dump() if target else None,
        "phase": session.phase.value,
    }
