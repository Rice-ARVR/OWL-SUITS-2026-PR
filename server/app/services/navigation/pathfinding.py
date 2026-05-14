import math
from typing import List, Tuple

from app.models.nav_model import Hazard, Position

# --- Helper Types ---
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
    """
    Expands a polygon using vertex normals to ensure a uniform safety buffer,
    resolving issues with concave shapes and centroid distortion.
    """
    if not polygon:
        return []

    n = len(polygon)
    expanded = []

    for i in range(n):
        # Current vertex, previous vertex, and next vertex
        curr = polygon[i]
        prev = polygon[(i - 1) % n]
        nxt = polygon[(i + 1) % n]

        # Calculate edge vectors
        v1 = (curr[0] - prev[0], curr[1] - prev[1])
        v2 = (nxt[0] - curr[0], nxt[1] - curr[1])

        # Normalize edge vectors
        len1 = math.hypot(v1[0], v1[1])
        len2 = math.hypot(v2[0], v2[1])

        if len1 == 0 or len2 == 0:
            expanded.append(curr)
            continue

        # Get unit normals for both edges (left-hand normal)
        n1 = (-v1[1] / len1, v1[0] / len1)
        n2 = (-v2[1] / len2, v2[0] / len2)

        # Average the normals to find the vertex normal
        bisector_x = n1[0] + n2[0]
        bisector_y = n1[1] + n2[1]

        bisector_len = math.hypot(bisector_x, bisector_y)

        if bisector_len < 1e-6:  # Handle collinear cases
            expanded.append((curr[0] + n1[0] * offset, curr[1] + n1[1] * offset))
        else:
            # Scale the bisector to ensure a uniform perpendicular offset
            scale = offset / (bisector_len / 2)  # Geometric compensation for the angle
            expanded.append(
                (
                    curr[0] + (bisector_x / bisector_len) * scale,
                    curr[1] + (bisector_y / bisector_len) * scale,
                )
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
        # Midpoint check ensures the line doesn't cut through the hazard interior
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        if point_in_polygon(mid, poly):
            return False
    return True


def find_path_around_hazards(
    start: Position, end: Position, hazards: List[Hazard]
) -> List[Position]:
    OFFSET_M = 15.0  # Buffer distance
    start_pt = (start.x, start.y)
    end_pt = (end.x, end.y)

    expanded_polygons = []
    for h in hazards:
        raw_poly = [(p.x, p.y) for p in h.points]
        expanded_polygons.append(expand_polygon(raw_poly, OFFSET_M))

    if line_clears_all_hazards(start_pt, end_pt, expanded_polygons):
        return [end]

    nodes: List[Point] = [start_pt]
    for poly in expanded_polygons:
        for v in poly:
            # Graph nodes exclude vertices inside other hazard buffers
            if not any(
                point_in_polygon(v, other)
                for other in expanded_polygons
                if other is not poly
            ):
                nodes.append(v)

    nodes.append(end_pt)
    n = len(nodes)
    adj = [[float("inf")] * n for _ in range(n)]

    for i in range(n):
        for j in range(i + 1, n):
            if line_clears_all_hazards(nodes[i], nodes[j], expanded_polygons):
                d = dist(nodes[i], nodes[j])
                adj[i][j] = adj[j][i] = d

    # Dijkstra
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
                    distances[v], prev[v] = alt, u

    if distances[n - 1] == float("inf"):
        return [end]

    path_pts, cur = [], n - 1
    while cur != -1:
        path_pts.insert(0, nodes[cur])
        cur = prev[cur]

    return [Position(x=p[0], y=p[1]) for p in path_pts[1:]]
