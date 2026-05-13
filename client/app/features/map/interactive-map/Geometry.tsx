import type { Point, Hazard } from "~/types/map.ts";

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const d1x = a2.x - a1.x,
        d1y = a2.y - a1.y;
    const d2x = b2.x - b1.x,
        d2y = b2.y - b1.y;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false;

    const dx = b1.x - a1.x,
        dy = b1.y - a1.y;
    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x,
            yi = polygon[i].y;
        const xj = polygon[j].x,
            yj = polygon[j].y;
        if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function expandPolygon(polygon: Point[], offset: number): Point[] {
    // Compute centroid
    const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
    const cy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
    // Push each vertex outward from centroid
    return polygon.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return p;
        return {
            x: p.x + (dx / dist) * offset,
            y: p.y + (dy / dist) * offset,
        };
    });
}

function lineIntersectsPolygon(a: Point, b: Point, polygon: Point[]): boolean {
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        if (segmentsIntersect(a, b, polygon[i], polygon[j])) return true;
    }
    return false;
}

function lineClearsAllHazards(a: Point, b: Point, expandedPolygons: Point[][]): boolean {
    for (const poly of expandedPolygons) {
        if (lineIntersectsPolygon(a, b, poly)) return false;
    }
    // Also check midpoint isn't inside any polygon
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (const poly of expandedPolygons) {
        if (pointInPolygon(mid, poly)) return false;
    }
    return true;
}

export function dist(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function findPathAroundHazards(start: Point, end: Point, closedHazards: Hazard[]): Point[] {
    const OFFSET = 15;
    const expandedPolygons = closedHazards.map((h) => expandPolygon(h.points, OFFSET));

    // If direct line is clear, go straight
    if (lineClearsAllHazards(start, end, expandedPolygons)) {
        return [start, end];
    }

    // Build visibility graph from start, end, and all expanded polygon vertices
    const nodes: Point[] = [start];
    const vertexSets: Point[][] = [];

    for (const poly of expandedPolygons) {
        vertexSets.push(poly);
        for (const v of poly) {
            // Only add vertices that aren't inside another polygon
            let insideAnother = false;
            for (const otherPoly of expandedPolygons) {
                if (otherPoly === poly) continue;
                if (pointInPolygon(v, otherPoly)) {
                    insideAnother = true;
                    break;
                }
            }
            if (!insideAnother) nodes.push(v);
        }
    }
    nodes.push(end);

    const n = nodes.length;

    // Build adjacency matrix
    const adj: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (lineClearsAllHazards(nodes[i], nodes[j], expandedPolygons)) {
                const d = dist(nodes[i], nodes[j]);
                adj[i][j] = d;
                adj[j][i] = d;
            }
        }
    }

    // Dijkstra from node 0 (start) to node n-1 (end)
    const visited = new Array(n).fill(false);
    const distances = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(-1);
    distances[0] = 0;

    for (let iter = 0; iter < n; iter++) {
        let u = -1;
        let minDist = Infinity;
        for (let i = 0; i < n; i++) {
            if (!visited[i] && distances[i] < minDist) {
                minDist = distances[i];
                u = i;
            }
        }
        if (u === -1) break;
        visited[u] = true;

        for (let v = 0; v < n; v++) {
            if (!visited[v] && adj[u][v] < Infinity) {
                const alt = distances[u] + adj[u][v];
                if (alt < distances[v]) {
                    distances[v] = alt;
                    prev[v] = u;
                }
            }
        }
    }

    // Reconstruct path
    if (distances[n - 1] === Infinity) {
        // No path found, fall back to straight line
        return [start, end];
    }

    const path: Point[] = [];
    let cur = n - 1;
    while (cur !== -1) {
        path.unshift(nodes[cur]);
        cur = prev[cur];
    }
    return path;
}
