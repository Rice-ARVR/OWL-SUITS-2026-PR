import math
from typing import Iterator, Tuple


def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def calculate_bearing(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate bearing from point 1 to point 2 in degrees (0-360)."""
    dx = x2 - x1
    dy = y2 - y1
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    return (angle_deg + 360) % 360


def rotate_point(
    x: float, y: float, angle_rad: float, origin_x: float = 0, origin_y: float = 0
) -> Tuple[float, float]:
    """Rotate a point around an origin by angle_rad radians."""
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    dx = x - origin_x
    dy = y - origin_y
    new_dx = dx * cos_a - dy * sin_a
    new_dy = dx * sin_a + dy * cos_a
    return origin_x + new_dx, origin_y + new_dy


def lidar_to_world_coords(
    sensor_index: int,
    distance_cm: float,
    rover_pos: Tuple[float, float],
    rover_heading: float,
) -> Tuple[float, float]:
    """Convert LIDAR sensor reading to world coordinates.

    Sensor indices: 0-16, spaced evenly around rover.
    Sensor 0 is forward, increasing clockwise.
    """
    # Convert distance to meters
    distance_m = distance_cm / 100.0

    # Sensor angle relative to rover heading (forward is 0)
    sensor_angle_deg = (sensor_index * 360.0) / 17.0
    sensor_angle_rad = math.radians(sensor_angle_deg)

    # World angle = rover heading + sensor angle
    world_angle_rad = math.radians(rover_heading) + sensor_angle_rad

    # Calculate world position
    world_x = rover_pos[0] + distance_m * math.cos(world_angle_rad)
    world_y = rover_pos[1] + distance_m * math.sin(world_angle_rad)

    return world_x, world_y


def generate_square_spiral_waypoints(
    center_x: float, center_y: float, arm_spacing_m: float, max_radius: float
) -> Iterator[Tuple[float, float]]:
    """Generate waypoints for an Archimedean square spiral.

    Starts at center, moves outward in square pattern with given arm spacing.
    """
    directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]  # NE, SE, SW, NW
    x, y = center_x, center_y
    step = arm_spacing_m
    layer = 0

    yield x, y  # Start at center

    while True:
        for dx, dy in directions:
            for _ in range(layer * 2 + 1):
                x += dx * step
                y += dy * step
                if calculate_distance(center_x, center_y, x, y) > max_radius:
                    return
                yield x, y
        layer += 1
