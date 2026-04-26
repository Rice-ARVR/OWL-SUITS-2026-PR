import asyncio
import math
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from server.app.models.nav_model import (
    DistanceCategory,
    LidarReading,
    LidarScan,
    NavigationState,
    NavigationStateData,
    NavigationTarget,
    OccupancyCell,
    OccupancyGrid,
    OccupancyState,
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
    lidar_to_world_coords,
)
from app.services.rover_control_service import send_rover_command
import app.services.telemetry.telemetry_service as telemetry_service
import app.services.telemetry.tss_client as tss_client


# --- Constants ---

LNP_POSITION = Position(x=-6090.0, y=-10485.6)
SEARCH_RADIUS_M = 548.7
GRID_CELL_SIZE_M = 25.0
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
    """Calculate search radius based on LTV max speed and time."""
    return max_speed_ms * time_elapsed_s


def categorize_rssi(rssi_value: float) -> DistanceCategory:
    """Categorize RSSI value into distance category."""
    if rssi_value >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
        return DistanceCategory.STRONG
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
        return DistanceCategory.MODERATE
    elif rssi_value >= RSSI_THRESHOLDS[DistanceCategory.WEAK]:
        return DistanceCategory.WEAK
    else:
        return DistanceCategory.VERY_WEAK


def get_rssi_distance_range(category: DistanceCategory) -> Tuple[float, float]:
    """Get distance range for RSSI category in meters."""
    ranges = {
        DistanceCategory.STRONG: (0, 100),
        DistanceCategory.MODERATE: (100, 462),
        DistanceCategory.WEAK: (462, 1200),
        DistanceCategory.VERY_WEAK: (1200, float('inf')),
    }
    return ranges[category]


def grid_key(sector_x: int, sector_y: int) -> str:
    """Generate key for grid cell."""
    return f"{sector_x},{sector_y}"


def position_to_sector(x: float, y: float) -> Tuple[int, int]:
    """Convert world position to grid sector."""
    sector_x = int(math.floor(x / GRID_CELL_SIZE_M))
    sector_y = int(math.floor(y / GRID_CELL_SIZE_M))
    return sector_x, sector_y


def sector_to_position(sector_x: int, sector_y: int) -> Tuple[float, float]:
    """Convert grid sector to world position (center of cell)."""
    x = (sector_x + 0.5) * GRID_CELL_SIZE_M
    y = (sector_y + 0.5) * GRID_CELL_SIZE_M
    return x, y


# --- Grid Management ---

def initialize_occupancy_grid(center_x: float, center_y: float, radius_m: float) -> OccupancyGrid:
    """Create initial occupancy grid within search radius."""
    cells: Dict[str, OccupancyCell] = {}

    # Calculate grid bounds
    min_sector_x = int(math.floor((center_x - radius_m) / GRID_CELL_SIZE_M))
    max_sector_x = int(math.floor((center_x + radius_m) / GRID_CELL_SIZE_M))
    min_sector_y = int(math.floor((center_y - radius_m) / GRID_CELL_SIZE_M))
    max_sector_y = int(math.floor((center_y + radius_m) / GRID_CELL_SIZE_M))

    for sx in range(min_sector_x, max_sector_x + 1):
        for sy in range(min_sector_y, max_sector_y + 1):
            cell_x, cell_y = sector_to_position(sx, sy)
            if calculate_distance(center_x, center_y, cell_x, cell_y) <= radius_m:
                key = grid_key(sx, sy)
                cells[key] = OccupancyCell(
                    sector_x=sx,
                    sector_y=sy,
                    state=OccupancyState.UNEXPLORED,
                )

    return OccupancyGrid(cells=cells)


def update_occupancy_grid(grid: OccupancyGrid, rover_x: float, rover_y: float, rssi_value: float, best_rssi: float) -> Tuple[OccupancyGrid, List[OccupancyCell]]:
    """Update grid based on ping result. Returns updated grid and changed cells."""
    sector_x, sector_y = position_to_sector(rover_x, rover_y)
    key = grid_key(sector_x, sector_y)

    changed_cells = []

    # Update current cell
    if key in grid.cells:
        cell = grid.cells[key]
        cell.state = OccupancyState.SEARCHED
        cell.last_rssi = rssi_value
        cell.last_visit_time = datetime.now()
        changed_cells.append(cell)

        # Mark as HOT if signal improved
        if rssi_value >= best_rssi:
            cell.state = OccupancyState.HOT

        # Mark neighbors as AVOID if signal degraded
        elif rssi_value < best_rssi:
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nkey = grid_key(sector_x + dx, sector_y + dy)
                    if nkey in grid.cells:
                        ncell = grid.cells[nkey]
                        if ncell.state == OccupancyState.UNEXPLORED:
                            ncell.state = OccupancyState.AVOID
                            changed_cells.append(ncell)

    return grid, changed_cells


# --- Waypoint Generation ---

def generate_initial_rings(center_x: float, center_y: float) -> List[Tuple[float, float]]:
    """Generate 16 waypoints in 3 concentric rings."""
    rings = [
        (150.0, [0, 90, 180, 270]),  # Ring 1: 4 waypoints
        (350.0, [0, 60, 120, 180, 240, 300]),  # Ring 2: 6 waypoints
        (550.0, [30, 90, 150, 210, 270, 330]),  # Ring 3: 6 waypoints
    ]

    waypoints = []
    for radius, angles in rings:
        for angle_deg in angles:
            angle_rad = math.radians(angle_deg)
            x = center_x + radius * math.cos(angle_rad)
            y = center_y + radius * math.sin(angle_rad)
            waypoints.append((x, y))

    return waypoints


def generate_square_spiral(center_x: float, center_y: float) -> List[Tuple[float, float]]:
    """Generate waypoints for tight spiral search."""
    waypoints = list(generate_square_spiral_waypoints(
        center_x, center_y, SPIRAL_ARM_SPACING_M, SPIRAL_MAX_RADIUS_M
    ))
    return waypoints[1:]  # Skip center point (already there)


# --- RSSI Processing ---

def process_rssi_signal(rssi_value: float) -> RssiSignalStrength:
    """Process raw RSSI value into categorized signal strength."""
    category = categorize_rssi(rssi_value)
    dist_min, dist_max = get_rssi_distance_range(category)
    return RssiSignalStrength(
        value=rssi_value,
        category=category,
        distance_min=dist_min,
        distance_max=dist_max,
        timestamp=datetime.now(),
    )


# --- LIDAR Processing ---

def analyze_lidar_priority(lidar_array: List[float], rover_position: Position, rover_heading: float) -> Tuple[bool, Optional[float], bool]:
    """Analyze LIDAR for tiered responses. Returns (brake_required, steering_adjustment, ltv_detected)."""
    readings = [
        LidarReading(index=i, distance_cm=dist, is_obstacle=dist < 1000)  # Assume obstacle if < 10m
        for i, dist in enumerate(lidar_array)
    ]

    brake_required = False
    steering_adjustment = None
    ltv_detected = False

    # Tier 1: Emergency braking
    tier1_distances = [readings[i].distance_cm for i in TIER_1_SENSORS if i < len(readings)]
    if any(dist < EMERGENCY_LIDAR_THRESHOLD_CM for dist in tier1_distances):
        brake_required = True

    # Tier 2: Frontal obstacle avoidance
    if not brake_required:
        tier2_distances = [readings[i].distance_cm for i in TIER_2_SENSORS if i < len(readings)]
        min_tier2 = min(tier2_distances) if tier2_distances else float('inf')
        if min_tier2 < FRONTAL_LIDAR_THRESHOLD_CM:
            # Find clearest sensor
            clearest_idx = TIER_2_SENSORS[tier2_distances.index(max(tier2_distances))]
            # Adjust steering toward clearest direction
            sensor_angle = (clearest_idx * 360.0) / 17.0
            error = sensor_angle - 0  # Forward is 0
            steering_adjustment = error / STEERING_GAIN
            steering_adjustment = max(-1.0, min(1.0, steering_adjustment))

    # Tier 3: Visual ID for LTV
    tier3_distances = [readings[i].distance_cm for i in TIER_3_SENSORS if i < len(readings)]
    # Check for vertical edge pattern (simplified: check if middle sensor is significantly closer)
    if len(tier3_distances) >= 3:
        left, middle, right = tier3_distances[0], tier3_distances[1], tier3_distances[2]
        if middle < left * 0.7 and middle < right * 0.7 and middle < 200:  # 2m threshold
            ltv_detected = True

    return brake_required, steering_adjustment, ltv_detected


def check_for_ltv_proximity(rssi_value: float, lidar_scan: LidarScan) -> Optional[Tuple[float, float]]:
    """Check if LTV is in close proximity based on RSSI and LIDAR."""
    if rssi_value > -20.0:  # Very strong signal
        # Check Tier 3 for vertical structure
        tier3_readings = [r for r in lidar_scan.readings if r.index in TIER_3_SENSORS]
        if any(r.distance_cm < 200 for r in tier3_readings):  # 2m
            # Calculate position of closest Tier 3 detection
            closest = min(tier3_readings, key=lambda r: r.distance_cm)
            # This is simplified; in reality, would need rover position and heading
            return (0, 0)  # Placeholder
    return None


# --- Navigation Logic ---

def get_gradient_waypoint(current_position: Position, success_vector: float, search_center: Position) -> Position:
    """Calculate next waypoint for gradient ascent."""
    angle_rad = math.radians(success_vector)
    new_x = current_position.x + GRADIENT_PROJECTION_M * math.cos(angle_rad)
    new_y = current_position.y + GRADIENT_PROJECTION_M * math.sin(angle_rad)

    # Constrain to search radius
    center_dist = calculate_distance(search_center.x, search_center.y, new_x, new_y)
    if center_dist > SEARCH_RADIUS_M:
        # Scale back to boundary
        scale = SEARCH_RADIUS_M / center_dist
        new_x = search_center.x + (new_x - search_center.x) * scale
        new_y = search_center.y + (new_y - search_center.y) * scale

    return Position(x=new_x, y=new_y)


def update_success_vector(from_position: Position, to_position: Position, improved: bool) -> float:
    """Update success vector based on signal improvement."""
    if improved:
        return calculate_bearing(from_position.x, from_position.y, to_position.x, to_position.y)
    else:
        # Pivot 45° toward unexplored sector (simplified)
        return (from_position.heading or 0) + 45.0


def has_reached_target(rover_x: float, rover_y: float, target: NavigationTarget) -> bool:
    """Check if rover has reached the target."""
    dist = calculate_distance(rover_x, rover_y, target.position.x, target.position.y)
    return dist <= target.arrival_threshold_m


async def navigate_to_target(rover_position: Position, target: NavigationTarget, lidar_scan: LidarScan, phase: SearchPhase) -> None:
    """Navigate toward target with LIDAR obstacle avoidance."""
    bearing_to_target = calculate_bearing(
        rover_position.x, rover_position.y,
        target.position.x, target.position.y
    )

    error = bearing_to_target - (rover_position.heading or 0)
    error = (error + 180) % 360 - 180  # Normalize to [-180, 180]

    steering = error / STEERING_GAIN
    steering = max(-1.0, min(1.0, steering))

    # Check LIDAR for overrides
    brake_required, lidar_steering, _ = analyze_lidar_priority(
        [r.distance_cm for r in lidar_scan.readings],
        rover_position,
        rover_position.heading or 0
    )

    if brake_required:
        throttle = 0
        brakes = 1.0
        steering = 0
    else:
        throttle = THROTTLE_SLOW if phase == SearchPhase.TIGHT_SPIRAL else THROTTLE_NORMAL
        brakes = 0.0
        if lidar_steering is not None:
            steering = lidar_steering

    await send_rover_command({
        "throttle": throttle,
        "steering": steering,
        "brakes": brakes,
    })


# --- Session Management ---

async def start_search_session() -> SearchSession:
    """Initialize a new search session."""
    global ring_waypoints, current_ring_index

    session_id = str(uuid.uuid4())
    grid = initialize_occupancy_grid(LNP_POSITION.x, LNP_POSITION.y, SEARCH_RADIUS_M)

    session = SearchSession(
        session_id=session_id,
        lnp=LNP_POSITION,
        search_center=LNP_POSITION,  # Will be updated on arrival
        phase=SearchPhase.TRANSIT_TO_LNP,
        occupancy_grid=grid,
        success_vector=0.0,
        ping_history=[],
        best_rssi=float('-inf'),
        current_target=NavigationTarget(
            position=LNP_POSITION,
            description="Transit to Last Nominal Position",
            arrival_threshold_m=50.0,
        ),
    )

    # Initialize ring waypoints
    ring_waypoints = generate_initial_rings(LNP_POSITION.x, LNP_POSITION.y)
    current_ring_index = 0

    await navigation_state.update_session(session)
    return session


async def update_search_phase(new_phase: SearchPhase) -> None:
    """Update the current search phase."""
    state = await navigation_state.get_snapshot()
    if state.session:
        state.session.phase = new_phase
        await navigation_state.update_session(state.session)


# --- Ping Operations ---

async def execute_ping() -> Tuple[bool, float, DistanceCategory]:
    """Execute LTV ping and return results."""
    global last_ping_time

    now = datetime.now()
    if last_ping_time and (now - last_ping_time).total_seconds() < PING_COOLDOWN_S:
        return False, 0.0, DistanceCategory.VERY_WEAK

    # Send ping command
    await asyncio.to_thread(tss_client.send_ltv_ping_normal)

    # Wait and fetch updated RSSI
    await asyncio.sleep(1)  # Allow time for update
    ltv_data = await telemetry_service.ltv_data.get_snapshot()
    if ltv_data and ltv_data.signal:
        rssi = ltv_data.signal.strength
        category = categorize_rssi(rssi)
        last_ping_time = now

        # Record ping in history
        state = await navigation_state.get_snapshot()
        if state.session and state.rover_position:
            ping_record = PingRecord(
                timestamp=now,
                rssi=rssi,
                rover_position=state.rover_position,
                signal_category=category,
                sector_x=position_to_sector(state.rover_position.x, state.rover_position.y)[0],
                sector_y=position_to_sector(state.rover_position.x, state.rover_position.y)[1],
            )
            state.session.ping_history.append(ping_record)
            await navigation_state.update_session(state.session)

        return True, rssi, category

    return False, 0.0, DistanceCategory.VERY_WEAK


# --- Main Execution ---

async def execute_navigation_step(rover_x: float, rover_y: float, rover_heading: float, lidar_array: List[float]) -> Dict:
    """Main navigation execution step called frequently."""
    # Update state
    position = Position(x=rover_x, y=rover_y, heading=rover_heading)
    await navigation_state.update_rover_position(position)

    # Process LIDAR
    readings = [LidarReading(index=i, distance_cm=dist, is_obstacle=dist < 1000)
                for i, dist in enumerate(lidar_array)]
    lidar_scan = LidarScan(
        readings=readings,
        clear_ahead=all(r.distance_cm > 200 for r in readings if r.index in TIER_2_SENSORS),
        closest_obstacle_distance=min((r.distance_cm for r in readings), default=float('inf'))
    )
    await navigation_state.update_lidar(lidar_scan)

    state = await navigation_state.get_snapshot()
    if not state.session or not state.autonomous_driving:
        return {"throttle": 0, "steering": 0, "brakes": 0, "next_target": None, "phase": SearchPhase.IDLE.value}

    session = state.session
    target = session.current_target

    if target and has_reached_target(rover_x, rover_y, target):
        # Reached current target
        if session.phase == SearchPhase.TRANSIT_TO_LNP:
            # Arrived at LNP, start concentric search
            session.search_center = position
            session.phase = SearchPhase.CONCENTRIC_SEARCH
            # Take initial ping
            success, rssi, category = await execute_ping()
            if success:
                session.best_rssi = rssi
                # Update grid
                session.occupancy_grid, _ = update_occupancy_grid(
                    session.occupancy_grid, rover_x, rover_y, rssi, session.best_rssi
                )
                # Set first ring waypoint
                if ring_waypoints:
                    wx, wy = ring_waypoints[0]
                    session.current_target = NavigationTarget(
                        position=Position(x=wx, y=wy),
                        description=f"Ring waypoint 1/{len(ring_waypoints)}",
                        arrival_threshold_m=10.0,
                    )
                    current_ring_index = 0

        elif session.phase == SearchPhase.CONCENTRIC_SEARCH:
            # Execute ping at waypoint
            success, rssi, category = await execute_ping()
            if success:
                # Update grid and check for improvements
                old_best = session.best_rssi
                if rssi > session.best_rssi:
                    session.best_rssi = rssi
                    session.success_vector = calculate_bearing(
                        session.search_center.x, session.search_center.y, rover_x, rover_y
                    )

                session.occupancy_grid, _ = update_occupancy_grid(
                    session.occupancy_grid, rover_x, rover_y, rssi, old_best
                )

                # Check for phase transition
                if rssi >= RSSI_THRESHOLDS[DistanceCategory.MODERATE]:
                    session.phase = SearchPhase.GRADIENT_ASCENT
                    new_target_pos = get_gradient_waypoint(position, session.success_vector, session.search_center)
                    session.current_target = NavigationTarget(
                        position=new_target_pos,
                        description="Gradient ascent waypoint",
                        arrival_threshold_m=10.0,
                    )
                else:
                    # Move to next ring waypoint
                    global current_ring_index
                    current_ring_index += 1
                    if current_ring_index < len(ring_waypoints):
                        wx, wy = ring_waypoints[current_ring_index]
                        session.current_target = NavigationTarget(
                            position=Position(x=wx, y=wy),
                            description=f"Ring waypoint {current_ring_index + 1}/{len(ring_waypoints)}",
                            arrival_threshold_m=10.0,
                        )
                    else:
                        # All ring waypoints done, fallback to gradient
                        session.phase = SearchPhase.GRADIENT_ASCENT
                        session.success_vector = 0.0
                        new_target_pos = get_gradient_waypoint(position, session.success_vector, session.search_center)
                        session.current_target = NavigationTarget(
                            position=new_target_pos,
                            description="Gradient ascent waypoint",
                            arrival_threshold_m=10.0,
                        )

        elif session.phase == SearchPhase.GRADIENT_ASCENT:
            # Execute ping at waypoint
            success, rssi, category = await execute_ping()
            if success:
                old_best = session.best_rssi
                improved = rssi > session.best_rssi
                if improved:
                    session.best_rssi = rssi
                    session.success_vector = calculate_bearing(
                        session.ping_history[-1].rover_position.x if session.ping_history else rover_x,
                        session.ping_history[-1].rover_position.y if session.ping_history else rover_y,
                        rover_x, rover_y
                    )

                session.occupancy_grid, _ = update_occupancy_grid(
                    session.occupancy_grid, rover_x, rover_y, rssi, old_best
                )

                # Check for phase transition
                if rssi >= RSSI_THRESHOLDS[DistanceCategory.STRONG]:
                    session.phase = SearchPhase.TIGHT_SPIRAL
                    spiral_points = generate_square_spiral(session.search_center.x, session.search_center.y)
                    if spiral_points:
                        session.current_target = NavigationTarget(
                            position=Position(x=spiral_points[0][0], y=spiral_points[0][1]),
                            description="Spiral search waypoint",
                            arrival_threshold_m=5.0,
                        )
                else:
                    # Continue gradient ascent
                    if not improved:
                        # Pivot 45° toward unexplored
                        session.success_vector += 45.0
                    new_target_pos = get_gradient_waypoint(position, session.success_vector, session.search_center)
                    session.current_target = NavigationTarget(
                        position=new_target_pos,
                        description="Gradient ascent waypoint",
                        arrival_threshold_m=10.0,
                    )

        elif session.phase == SearchPhase.TIGHT_SPIRAL:
            # Execute ping at spiral waypoint
            success, rssi, category = await execute_ping()
            if success:
                session.occupancy_grid, _ = update_occupancy_grid(
                    session.occupancy_grid, rover_x, rover_y, rssi, session.best_rssi
                )

            # Check for LTV found conditions
            ltv_pos = check_for_ltv_proximity(session.best_rssi, lidar_scan)
            if ltv_pos or session.best_rssi > -10.0:
                session.phase = SearchPhase.FOUND
                session.current_target = None
            else:
                # Generate next spiral waypoint (simplified)
                spiral_points = generate_square_spiral(session.search_center.x, session.search_center.y)
                if spiral_points:
                    # Skip already visited points (simplified)
                    session.current_target = NavigationTarget(
                        position=Position(x=spiral_points[0][0], y=spiral_points[0][1]),
                        description="Spiral search waypoint",
                        arrival_threshold_m=5.0,
                    )

        await navigation_state.update_session(session)

    # Navigate to current target
    if target:
        await navigate_to_target(position, target, lidar_scan, session.phase)

    return {
        "throttle": THROTTLE_NORMAL if session.phase != SearchPhase.TIGHT_SPIRAL else THROTTLE_SLOW,
        "steering": 0,  # Will be set by navigate_to_target
        "brakes": 0,
        "next_target": target.model_dump() if target else None,
        "phase": session.phase.value,
    }</content>
<parameter name="filePath">/workspace/server/app/services/navigation/navigation_service.py