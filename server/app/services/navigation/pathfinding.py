import math
from typing import List, Tuple

from app.models.nav_model import Hazard, Position

# --- Helper Types ---
# We use Tuple[float, float] internally for speed, converting back to Position later.
Point = Tuple[float, float]


def dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def segments_intersect(a1: Point, a2: Point, b1: Point, b2: Point) -> bool:
    d1x, d1y = a2[0] - a1[0], a2[1] - a1[1]
    d2x, d2y = b2[0] - b1[0], b2[1] - b1[1]

    cross = d1x * d2y - d1y * d2x
    if abs(cross) < 1e-10:
        return False

    dx, dy = b1[0] - a1[0], b1[1] - a1[1]
    t = (dx * d2y - dy * d2x) / cross
    u = (dx * d1y - dy * d1x) / cross

    return 0.001 < t < 0.999 and 0.001 < u < 0.999


def point_in_polygon(p: Point, polygon: List[Point]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]

        if (yi > p[1]) != (yj > p[1]) and p[0] < ((xj - xi) * (p[1] - yi)) / (
            yj - yi
        ) + xi:
            inside = not inside
        j = i
    return inside


def expand_polygon(polygon: List[Point], offset: float) -> List[Point]:
    if not polygon:
        return []

    # Compute centroid
    cx = sum(p[0] for p in polygon) / len(polygon)
    cy = sum(p[1] for p in polygon) / len(polygon)

    expanded = []
    # Push each vertex outward from centroid
    for p in polygon:
        dx, dy = p[0] - cx, p[1] - cy
        distance = math.hypot(dx, dy)
        if distance == 0:
            expanded.append(p)
        else:
            expanded.append(
                (p[0] + (dx / distance) * offset, p[1] + (dy / distance) * offset)
            )
    return expanded


def line_intersects_polygon(a: Point, b: Point, polygon: List[Point]) -> bool:
    for i in range(len(polygon)):
        j = (i + 1) % len(polygon)
        if segments_intersect(a, b, polygon[i], polygon[j]):
            return True
    return False


def line_clears_all_hazards(
    a: Point, b: Point, expanded_polygons: List[List[Point]]
) -> bool:
    for poly in expanded_polygons:
        if line_intersects_polygon(a, b, poly):
            return False

    # Also check midpoint isn't inside any polygon
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    for poly in expanded_polygons:
        if point_in_polygon(mid, poly):
            return False

    return True


def find_path_around_hazards(
    start: Position, end: Position, hazards: List[Hazard]
) -> List[Position]:
    """
    Uses a Visibility Graph and Dijkstra's algorithm to find the shortest
    safe path around polygonal hazards.
    """
    OFFSET_M = 15.0  # Buffer distance to stay away from the edge of hazards

    start_pt = (start.x, start.y)
    end_pt = (end.x, end.y)

    # Convert Hazard models to raw point lists and expand them
    expanded_polygons = []
    for h in hazards:
        raw_poly = [(p.x, p.y) for p in h.points]
        expanded_polygons.append(expand_polygon(raw_poly, OFFSET_M))

    # If direct line is clear, go straight
    if line_clears_all_hazards(start_pt, end_pt, expanded_polygons):
        return [
            end
        ]  # Returning just the end point implies a straight line from current position

    # Build visibility graph from start, end, and all expanded polygon vertices
    nodes: List[Point] = [start_pt]

    for poly in expanded_polygons:
        for v in poly:
            # Only add vertices that aren't inside another polygon
            inside_another = False
            for other_poly in expanded_polygons:
                if other_poly is poly:
                    continue
                if point_in_polygon(v, other_poly):
                    inside_another = True
                    break
            if not inside_another:
                nodes.append(v)

    nodes.append(end_pt)
    n = len(nodes)

    # Build adjacency matrix (Infinity implies no line of sight)
    adj = [[float("inf")] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if line_clears_all_hazards(nodes[i], nodes[j], expanded_polygons):
                d = dist(nodes[i], nodes[j])
                adj[i][j] = d
                adj[j][i] = d

    # Dijkstra from node 0 (start) to node n-1 (end)
    visited = [False] * n
    distances = [float("inf")] * n
    prev = [-1] * n
    distances[0] = 0

    for _ in range(n):
        u = -1
        min_dist = float("inf")
        for i in range(n):
            if not visited[i] and distances[i] < min_dist:
                min_dist = distances[i]
                u = i

        if u == -1:
            break

        visited[u] = True

        for v in range(n):
            if not visited[v] and adj[u][v] < float("inf"):
                alt = distances[u] + adj[u][v]
                if alt < distances[v]:
                    distances[v] = alt
                    prev[v] = u

    # Reconstruct path
    if distances[n - 1] == float("inf"):
        # No path found, fall back to straight line (auto_drive reactive dodge)
        return [end]

    path_pts = []
    cur = n - 1
    while cur != -1:
        path_pts.insert(0, nodes[cur])
        cur = prev[cur]

    # Convert points back to Position objects (skip the starting point itself)
    return [Position(x=p[0], y=p[1]) for p in path_pts[1:]]
