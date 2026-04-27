import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./InteractiveMap.module.css";
import { useNavigationState } from "./useNavigationState";

// ── Types ──────────────────────────────────────────────

interface Point {
    x: number;
    y: number;
}

export interface MapPoint {
    id: string;
    x: number;
    y: number;
    label: string;
    description: string;
    type: "poi" | "base" | "rover" | "custom";
}

export type HazardType = "regolith" | "debris" | "crater";

export interface Hazard {
    id: string;
    points: Point[];
    closed: boolean;
    types: HazardType[];
}

type Mode = "navigate" | "addPOI" | "plotHazard" | "hazardDetails" | "directions" | "autonomousLTV";
type POIStep = "placing" | "naming" | "describing";
type DirectionsStep = "selectDestination" | "review" | "computing" | "active";

export interface RoverPosition {
    x: number;
    y: number;
    heading: number; // degrees, 0 = up/north
}

interface InteractiveMapProps {
    // extensibility - add any external props here
}

interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

// ── Geometry utilities for pathfinding ─────────────────

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

function dist(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function findPathAroundHazards(start: Point, end: Point, closedHazards: Hazard[]): Point[] {
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

// ── Grid component ─────────────────────────────────────

function Grid({ spacing, viewBox }: { spacing: number; viewBox: ViewBox }) {
    const lines = [];
    const startX = Math.floor(viewBox.x / spacing) * spacing;
    const startY = Math.floor(viewBox.y / spacing) * spacing;
    const endX = viewBox.x + viewBox.w;
    const endY = viewBox.y + viewBox.h;

    for (let x = startX; x <= endX; x += spacing) {
        lines.push(
            <line
                key={`v-${x}`}
                x1={x}
                y1={viewBox.y}
                x2={x}
                y2={viewBox.y + viewBox.h}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
    }
    for (let y = startY; y <= endY; y += spacing) {
        lines.push(
            <line
                key={`h-${y}`}
                x1={viewBox.x}
                y1={y}
                x2={viewBox.x + viewBox.w}
                y2={y}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
    }
    return <g>{lines}</g>;
}

// ── Marker component ───────────────────────────────────

function Marker({
    point,
    roverPosition,
    onDelete,
    isHovered,
    onHover,
    onLeave,
}: {
    point: MapPoint;
    roverPosition: RoverPosition;
    onDelete: (id: string) => void;
    isHovered: boolean;
    onHover: () => void;
    onLeave: () => void;
}) {
    const color = "#6ee7b7";

    const dx = point.x - roverPosition.x;
    const dy = point.y - roverPosition.y;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

    const descText = point.description?.trim() || "";
    // Tooltip dimensions — estimate lines based on ~24 chars per line at 11px monospace in 164px width
    const tooltipW = 180;
    const charsPerLine = 22;
    const estimatedLines = Math.ceil(descText.length / charsPerLine);
    const tooltipH = Math.max(30, estimatedLines * 16 + 14);
    const tooltipX = point.x - tooltipW / 2;
    const tooltipY = point.y - 55 - tooltipH;

    return (
        <g onMouseEnter={onHover} onMouseLeave={onLeave}>
            {/* Pin shape — tip at (point.x, point.y) */}
            <path
                d={`M ${point.x} ${point.y}
            C ${point.x - 4} ${point.y - 6}, ${point.x - 14} ${point.y - 16}, ${point.x - 14} ${point.y - 26}
            A 14 14 0 1 1 ${point.x + 14} ${point.y - 26}
            C ${point.x + 14} ${point.y - 16}, ${point.x + 4} ${point.y - 6}, ${point.x} ${point.y} Z`}
                fill={color}
                stroke="#1e1e22"
                strokeWidth="2"
            />
            {/* Inner circle */}
            <circle cx={point.x} cy={point.y - 26} r="5" fill="#1e1e22" />

            {/* Label */}
            <text x={point.x} y={point.y + 14} textAnchor="middle" fill="#ccc" fontSize="11">
                {point.label}: {distance}m
            </text>

            {/* X delete button — visible on hover */}
            {isHovered && (
                <g
                    cursor="pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(point.id);
                    }}
                >
                    <circle
                        cx={point.x + 12}
                        cy={point.y - 38}
                        r="8"
                        fill="#1e1e22"
                        stroke="#888"
                        strokeWidth="1"
                    />
                    <line
                        x1={point.x + 8}
                        y1={point.y - 42}
                        x2={point.x + 16}
                        y2={point.y - 34}
                        stroke="#e74c3c"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                    <line
                        x1={point.x + 16}
                        y1={point.y - 42}
                        x2={point.x + 8}
                        y2={point.y - 34}
                        stroke="#e74c3c"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                </g>
            )}

            {/* Hover tooltip */}
            {isHovered && descText && (
                <g>
                    <rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipW}
                        height={tooltipH}
                        rx="6"
                        fill="#1e1e22"
                        stroke="#444"
                        strokeWidth="1"
                    />
                    {/* Arrow */}
                    <polygon
                        points={`${point.x - 6},${tooltipY + tooltipH} ${point.x + 6},${tooltipY + tooltipH} ${point.x},${tooltipY + tooltipH + 8}`}
                        fill="#1e1e22"
                        stroke="#444"
                        strokeWidth="1"
                    />
                    {/* Cover arrow top border */}
                    <line
                        x1={point.x - 6}
                        y1={tooltipY + tooltipH}
                        x2={point.x + 6}
                        y2={tooltipY + tooltipH}
                        stroke="#1e1e22"
                        strokeWidth="2"
                    />
                    <foreignObject
                        x={tooltipX + 8}
                        y={tooltipY + 6}
                        width={tooltipW - 16}
                        height={tooltipH - 12}
                    >
                        <div
                            style={{
                                color: "#ccc",
                                fontSize: "11px",
                                lineHeight: "1.4",
                                overflow: "hidden",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                whiteSpace: "normal",
                            }}
                        >
                            {descText}
                        </div>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}

// ── Hazard shape component ─────────────────────────────

function HazardShape({ hazard, onDelete }: { hazard: Hazard; onDelete: (id: string) => void }) {
    const pointsStr = hazard.points.map((p) => `${p.x},${p.y}`).join(" ");
    const cx = hazard.points.reduce((sum, p) => sum + p.x, 0) / hazard.points.length;
    const cy = hazard.points.reduce((sum, p) => sum + p.y, 0) / hazard.points.length;

    // Octagon points for warning icon (radius 14, centered at cx,cy)
    const r = 14;
    const octagon = Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

    return (
        <g>
            {hazard.closed ? (
                <polygon
                    points={pointsStr}
                    fill="rgba(255, 138, 117, 0.08)"
                    stroke="#ff8a75"
                    strokeWidth="2"
                />
            ) : (
                <polyline points={pointsStr} fill="none" stroke="#ff8a75" strokeWidth="2" />
            )}

            {hazard.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="5" fill="#ff8a75" />
            ))}

            {hazard.closed && (
                <>
                    {/* Warning icon at centroid */}
                    <polygon
                        points={octagon}
                        fill="none"
                        stroke="#ff8a75"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    {/* Exclamation mark */}
                    <line
                        x1={cx}
                        y1={cy - 7}
                        x2={cx}
                        y2={cy + 2}
                        stroke="#ff8a75"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx={cx} cy={cy + 7} r="1.5" fill="#ff8a75" />

                    {/* Hazard types label */}
                    {hazard.types.length > 0 && (
                        <text x={cx} y={cy + 28} textAnchor="middle" fill="#ff8a75" fontSize="10">
                            {hazard.types.join(", ")}
                        </text>
                    )}

                    {/* X delete button centered below */}
                    <g
                        cursor="pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(hazard.id);
                        }}
                    >
                        <circle
                            cx={cx}
                            cy={cy + (hazard.types.length > 0 ? 44 : 30)}
                            r="9"
                            fill="#1e1e22"
                            stroke="#888"
                            strokeWidth="1"
                        />
                        <line
                            x1={cx - 4}
                            y1={cy + (hazard.types.length > 0 ? 40 : 26)}
                            x2={cx + 4}
                            y2={cy + (hazard.types.length > 0 ? 48 : 34)}
                            stroke="#e74c3c"
                            strokeWidth="2"
                            strokeLinecap="round"
                            pointerEvents="none"
                        />
                        <line
                            x1={cx + 4}
                            y1={cy + (hazard.types.length > 0 ? 40 : 26)}
                            x2={cx - 4}
                            y2={cy + (hazard.types.length > 0 ? 48 : 34)}
                            stroke="#e74c3c"
                            strokeWidth="2"
                            strokeLinecap="round"
                            pointerEvents="none"
                        />
                    </g>
                </>
            )}
        </g>
    );
}

// ── Rover icon component ───────────────────────────────

function RoverIcon({ position }: { position: RoverPosition }) {
    return (
        <g transform={`translate(${position.x}, ${position.y}) rotate(${position.heading})`}>
            {/* Shadow */}
            <ellipse cx="0" cy="2" rx="18" ry="6" fill="rgba(0,0,0,0.3)" />

            {/* Body */}
            <rect
                x="-14"
                y="-12"
                width="28"
                height="20"
                rx="4"
                fill="#555"
                stroke="#888"
                strokeWidth="1.5"
            />

            {/* Cabin / top */}
            <rect
                x="-8"
                y="-18"
                width="16"
                height="10"
                rx="3"
                fill="#666"
                stroke="#888"
                strokeWidth="1"
            />

            {/* Wheels */}
            <circle cx="-16" cy="-8" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="16" cy="-8" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="-16" cy="6" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="16" cy="6" r="4" fill="#333" stroke="#777" strokeWidth="1" />

            {/* Antenna */}
            <line x1="0" y1="-18" x2="0" y2="-28" stroke="#aaa" strokeWidth="1.5" />
            <circle cx="0" cy="-29" r="2" fill="#6ee7b7" />

            {/* Direction indicator (front) */}
            <polygon points="-4,-12 4,-12 0,-16" fill="#6ee7b7" opacity="0.8" />

            {/* Label */}
            <text x="0" y="22" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">
                ROVER
            </text>
        </g>
    );
}

// ── Main map component ─────────────────────────────────

export default function InteractiveMap({}: InteractiveMapProps = {}) {
    const svgRef = useRef<SVGSVGElement>(null);

    // ── Navigation SSE hook ──
    const { navState, connected, startAutonomy, stopAutonomy, executePing } = useNavigationState();

    // Derive rover position from SSE — handle null heading
    const roverPosition: RoverPosition = navState?.rover_position
        ? {
              x: navState.rover_position.x ?? 0,
              y: navState.rover_position.y ?? 0,
              heading: navState.rover_position.heading ?? 0,
          }
        : { x: 0, y: 0, heading: 0 };

    const isAutonomous = navState?.autonomous_driving ?? false;

    // Auto-center map on rover when position changes significantly
    const lastCenteredRef = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => {
        if (roverPosition.x === 0 && roverPosition.y === 0) return;
        const last = lastCenteredRef.current;
        if (
            !last ||
            Math.abs(roverPosition.x - last.x) > 500 ||
            Math.abs(roverPosition.y - last.y) > 500
        ) {
            setViewBox((prev) => ({
                ...prev,
                x: roverPosition.x - prev.w / 2,
                y: roverPosition.y - prev.h / 2,
            }));
            lastCenteredRef.current = { x: roverPosition.x, y: roverPosition.y };
        }
    }, [roverPosition.x, roverPosition.y]);

    const [points, setPoints] = useState<MapPoint[]>([]);
    const [hazards, setHazards] = useState<Hazard[]>([]);
    const [activeHazard, setActiveHazard] = useState<Hazard | null>(null);
    const [mousePos, setMousePos] = useState<Point | null>(null);
    const [mode, setMode] = useState<Mode>("navigate");

    // Autonomous LTV
    const [ltvX, setLtvX] = useState("");
    const [ltvY, setLtvY] = useState("");
    const [showManualConfirm, setShowManualConfirm] = useState(false);

    // FAB menu
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Hazard details step
    const [pendingHazard, setPendingHazard] = useState<Hazard | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<HazardType[]>([]);

    // POI workflow
    const [poiStep, setPoiStep] = useState<POIStep>("placing");
    const [pendingPOI, setPendingPOI] = useState<MapPoint | null>(null);
    const [poiName, setPoiName] = useState("");
    const [poiDescription, setPoiDescription] = useState("");
    const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

    // Directions workflow
    const [directionsStep, setDirectionsStep] = useState<DirectionsStep>("selectDestination");
    const [waypoints, setWaypoints] = useState<MapPoint[]>([]);
    const [routePath, setRoutePath] = useState<Point[]>([]);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [segmentDistances, setSegmentDistances] = useState<number[]>([]);

    const [viewBox, setViewBox] = useState<ViewBox>({
        x: -500,
        y: -400,
        w: 1000,
        h: 800,
    });

    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; vx: number; vy: number }>({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    });

    // ── Coordinate conversion ──

    const getSVGCoords = useCallback(
        (e: React.MouseEvent<SVGSVGElement> | MouseEvent): Point => {
            const svg = svgRef.current;
            if (!svg) return { x: 0, y: 0 };
            const rect = svg.getBoundingClientRect();
            const scaleX = viewBox.w / rect.width;
            const scaleY = viewBox.h / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX + viewBox.x,
                y: (e.clientY - rect.top) * scaleY + viewBox.y,
            };
        },
        [viewBox],
    );

    // ── Canvas click ──

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (isPanning) return;
        const { x, y } = getSVGCoords(e);

        if (mode === "addPOI" && poiStep === "placing") {
            const defaultName = `POI ${points.filter((p) => p.type === "poi").length + 1}`;
            setPendingPOI({
                id: crypto.randomUUID(),
                x,
                y,
                label: defaultName,
                description: "",
                type: "poi",
            });
            setPoiName(defaultName);
            setPoiDescription("");
            setPoiStep("naming");
        }

        if (mode === "plotHazard") {
            if (!activeHazard) {
                setActiveHazard({
                    id: crypto.randomUUID(),
                    points: [{ x, y }],
                    closed: false,
                    types: [],
                });
            } else {
                setActiveHazard((prev) =>
                    prev ? { ...prev, points: [...prev.points, { x, y }] } : null,
                );
            }
        }

        // Directions — click near a POI to add it as waypoint
        if (
            mode === "directions" &&
            (directionsStep === "selectDestination" || directionsStep === "review")
        ) {
            const clickRadius = 30;
            const nearest = points.find((p) => {
                const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
                return d < clickRadius;
            });
            if (nearest && !waypoints.find((w) => w.id === nearest.id)) {
                setWaypoints((prev) => [...prev, nearest]);
                setDirectionsStep("review");
            }
        }
    };

    // ── Mouse move ──

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const coords = getSVGCoords(e);

        if (isPanning) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const scaleX = viewBox.w / rect.width;
            const scaleY = viewBox.h / rect.height;
            setViewBox((prev) => ({
                ...prev,
                x: panStart.current.vx - dx * scaleX,
                y: panStart.current.vy - dy * scaleY,
            }));
            return;
        }

        if (mode === "plotHazard" && activeHazard) {
            setMousePos(coords);
        }
    };

    // ── Pan handlers ──

    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (mode === "navigate") {
            setIsPanning(true);
            panStart.current = {
                x: e.clientX,
                y: e.clientY,
                vx: viewBox.x,
                vy: viewBox.y,
            };
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // ── Hazard flow ──

    const finishPlotting = () => {
        if (activeHazard && activeHazard.points.length >= 2) {
            const closed = { ...activeHazard, closed: true };
            setPendingHazard(closed);
            setActiveHazard(null);
            setMousePos(null);
            setSelectedTypes([]);
            setMode("hazardDetails");
        }
    };

    const finishHazard = () => {
        if (pendingHazard) {
            setHazards((prev) => [...prev, { ...pendingHazard, types: selectedTypes }]);
            setPendingHazard(null);
            setSelectedTypes([]);
            setMode("navigate");
        }
    };

    const cancelAll = () => {
        setActiveHazard(null);
        setPendingHazard(null);
        setPendingPOI(null);
        setPoiStep("placing");
        setPoiName("");
        setPoiDescription("");
        setMousePos(null);
        setSelectedTypes([]);
        setWaypoints([]);
        setRoutePath([]);
        setSegmentDistances([]);
        setDirectionsStep("selectDestination");
        setLtvX("");
        setLtvY("");
        setMode("navigate");
        setShowAddMenu(false);
    };

    // ── Autonomous LTV workflow ──

    const handleStartAutonomousLTV = () => {
        setShowAddMenu(false);
        setLtvX("");
        setLtvY("");
        setMode("autonomousLTV");
    };

    const handleLaunchAutonomy = async () => {
        const x = parseFloat(ltvX);
        const y = parseFloat(ltvY);
        if (isNaN(x) || isNaN(y)) return;
        await startAutonomy();
        setMode("navigate");
    };

    const cancelAutonomousLTV = () => {
        setLtvX("");
        setLtvY("");
        setMode("navigate");
    };

    const handleManualModeRequest = () => {
        if (isAutonomous) {
            setShowManualConfirm(true);
        }
    };

    const confirmStopAutonomy = async () => {
        await stopAutonomy();
        setShowManualConfirm(false);
    };

    // ── Directions workflow ──

    const handleStartDirections = () => {
        setShowAddMenu(false);
        setWaypoints([]);
        setRoutePath([]);
        setDirectionsStep("selectDestination");
        setMode("directions");
    };

    const removeWaypoint = (index: number) => {
        setWaypoints((prev) => prev.filter((_, i) => i !== index));
        if (waypoints.length <= 1) {
            setDirectionsStep("selectDestination");
        }
    };

    const reorderWaypoints = (fromIndex: number, toIndex: number) => {
        setWaypoints((prev) => {
            const updated = [...prev];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);
            return updated;
        });
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            reorderWaypoints(dragIndex, dragOverIndex);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const computeRoute = () => {
        setDirectionsStep("computing");

        setTimeout(() => {
            // Build ordered list of stops: rover → waypoint1 → waypoint2 → ...
            const stops: Point[] = [
                { x: roverPosition.x, y: roverPosition.y },
                ...waypoints.map((w) => ({ x: w.x, y: w.y })),
            ];

            const closedHazards = hazards.filter((h) => h.closed);

            // For each segment, find a path that avoids hazards
            const fullPath: Point[] = [stops[0]];
            const distances: number[] = [];
            for (let i = 0; i < stops.length - 1; i++) {
                const segmentPath = findPathAroundHazards(stops[i], stops[i + 1], closedHazards);
                let segDist = 0;
                for (let j = 0; j < segmentPath.length - 1; j++) {
                    segDist += dist(segmentPath[j], segmentPath[j + 1]);
                }
                distances.push(Math.round(segDist));
                fullPath.push(...segmentPath.slice(1));
            }

            // TODO: Replace with backend call
            // const response = await fetch('/api/compute-route', {
            //   method: 'POST',
            //   body: JSON.stringify({ start: roverPosition, waypoints, hazards }),
            // });
            // const data = await response.json();
            // setRoutePath(data.path);

            setSegmentDistances(distances);
            setRoutePath(fullPath);
            setDirectionsStep("active");
        }, 1500);
    };

    const cancelDirections = () => {
        setWaypoints([]);
        setRoutePath([]);
        setSegmentDistances([]);
        setDirectionsStep("selectDestination");
        setMode("navigate");
    };

    const undoLastPoint = () => {
        if (!activeHazard) return;
        if (activeHazard.points.length <= 1) {
            setActiveHazard(null);
        } else {
            setActiveHazard((prev) =>
                prev ? { ...prev, points: prev.points.slice(0, -1) } : null,
            );
        }
    };

    const toggleHazardType = (type: HazardType) => {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
        );
    };

    // ── POI workflow ──

    const confirmPOIName = () => {
        if (!pendingPOI) return;
        const name = poiName.trim() || pendingPOI.label;
        setPendingPOI((prev) => (prev ? { ...prev, label: name } : null));
        setPoiStep("describing");
    };

    const confirmPOIDescription = () => {
        if (!pendingPOI) return;
        const finalPOI = {
            ...pendingPOI,
            label: poiName.trim() || pendingPOI.label,
            description: poiDescription.trim(),
        };
        setPoints((prev) => [...prev, finalPOI]);
        setPendingPOI(null);
        setPoiName("");
        setPoiDescription("");
        setPoiStep("placing");
    };

    const cancelPOI = () => {
        setPendingPOI(null);
        setPoiName("");
        setPoiDescription("");
        setPoiStep("placing");
        setMode("navigate");
    };

    // ── Delete handlers ──

    const deletePoint = (id: string) => {
        setPoints((prev) => prev.filter((p) => p.id !== id));
    };

    const deleteHazard = (id: string) => {
        setHazards((prev) => prev.filter((h) => h.id !== id));
    };

    // ── Keyboard shortcuts ──

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (mode === "addPOI" && pendingPOI) {
                    cancelPOI();
                } else {
                    cancelAll();
                }
            }
            if (e.key === "Enter" && mode === "plotHazard") finishPlotting();
            if (e.key === "Enter" && mode === "hazardDetails") finishHazard();
            if ((e.key === "z" && e.ctrlKey) || (e.key === "z" && e.metaKey)) {
                undoLastPoint();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    });

    // ── FAB handlers ──

    const handleAddPOI = () => {
        setShowAddMenu(false);
        setMode("addPOI");
    };

    const handlePlotHazard = () => {
        setShowAddMenu(false);
        setMode("plotHazard");
    };

    const cursorClass =
        mode === "navigate"
            ? isPanning
                ? styles.grabbing
                : styles.grab
            : mode === "directions"
              ? styles.pointer
              : styles.crosshair;

    const showPanel = mode === "plotHazard" || mode === "addPOI";
    const showDetailsPanel = mode === "hazardDetails";

    return (
        <div className={styles.wrapper}>
            {/* ── Plot Hazard / Add POI Panel (top-left) ── */}
            {showPanel && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            {mode === "plotHazard" ? (
                                <polygon
                                    points="12,2 22,20 2,20"
                                    stroke="#6ee7b7"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="3 2"
                                />
                            ) : (
                                <>
                                    <circle cx="12" cy="12" r="3" fill="#6ee7b7" />
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="9"
                                        stroke="#6ee7b7"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                </>
                            )}
                        </svg>
                        <span className={styles.panelTitle}>
                            {mode === "plotHazard" ? "Plot a Hazard" : "Add POI"}
                        </span>
                        <button
                            className={styles.panelClose}
                            onClick={() => {
                                if (mode === "addPOI" && pendingPOI) {
                                    cancelPOI();
                                } else {
                                    cancelAll();
                                }
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {mode === "plotHazard" && activeHazard && (
                        <>
                            <span className={styles.pointCount}>
                                {activeHazard.points.length} point
                                {activeHazard.points.length !== 1 ? "s" : ""} placed
                            </span>
                            <div className={styles.panelActions}>
                                <button className={styles.undoBtn} onClick={undoLastPoint}>
                                    Undo
                                </button>
                                {activeHazard.points.length >= 2 && (
                                    <button className={styles.doneBtn} onClick={finishPlotting}>
                                        ✓ Done
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {mode === "plotHazard" && !activeHazard && (
                        <p className={styles.panelHint}>Click on the map to place points</p>
                    )}

                    {mode === "addPOI" && poiStep === "placing" && (
                        <p className={styles.panelHint}>Click on the map to add a POI</p>
                    )}

                    {mode === "addPOI" && poiStep === "naming" && pendingPOI && (
                        <div className={styles.poiForm}>
                            <label className={styles.poiLabel}>Name</label>
                            <input
                                type="text"
                                className={styles.poiInput}
                                value={poiName}
                                onChange={(e) => setPoiName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        confirmPOIName();
                                    }
                                }}
                                autoFocus
                                placeholder="POI name..."
                            />
                            <button className={styles.doneBtn} onClick={confirmPOIName}>
                                Next
                            </button>
                        </div>
                    )}

                    {mode === "addPOI" && poiStep === "describing" && pendingPOI && (
                        <div className={styles.poiForm}>
                            <label className={styles.poiLabel}>Description</label>
                            <textarea
                                className={styles.poiTextarea}
                                value={poiDescription}
                                onChange={(e) => setPoiDescription(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        confirmPOIDescription();
                                    }
                                }}
                                autoFocus
                                placeholder="Description (optional)..."
                                rows={3}
                            />
                            <button className={styles.doneBtn} onClick={confirmPOIDescription}>
                                ✓ Add POI
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Add Details Panel (top-left) ── */}
            {showDetailsPanel && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <polygon
                                points="12,2 22,20 2,20"
                                stroke="#ff8a75"
                                strokeWidth="2"
                                fill="none"
                            />
                        </svg>
                        <span className={styles.panelTitle}>Add Details</span>
                        <button className={styles.panelClose} onClick={cancelAll}>
                            ×
                        </button>
                    </div>

                    <div className={styles.detailsBody}>
                        <span className={styles.detailsLabel}>Hazard Type</span>
                        <div className={styles.typeChips}>
                            {(["regolith", "debris", "crater"] as HazardType[]).map((type) => (
                                <button
                                    key={type}
                                    className={`${styles.typeChip} ${
                                        selectedTypes.includes(type) ? styles.typeChipSelected : ""
                                    }`}
                                    onClick={() => toggleHazardType(type)}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className={styles.finishBtn} onClick={finishHazard}>
                        Finish
                    </button>
                </div>
            )}

            {/* ── Directions Panel (top-left) ── */}
            {mode === "directions" && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 12h4l3-9 4 18 3-9h4"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                fill="none"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={styles.panelTitle}>
                            {directionsStep === "computing"
                                ? "Computing..."
                                : directionsStep === "active"
                                  ? "Route Active"
                                  : "Directions"}
                        </span>
                        <button className={styles.panelClose} onClick={cancelDirections}>
                            ×
                        </button>
                    </div>

                    {directionsStep === "selectDestination" && waypoints.length === 0 && (
                        <p className={styles.panelHint}>Click a POI to set destination</p>
                    )}

                    {(directionsStep === "review" || directionsStep === "selectDestination") &&
                        waypoints.length > 0 && (
                            <div className={styles.routeList}>
                                {/* Rover origin */}
                                <div className={styles.routeItem}>
                                    <div className={styles.routeIcon}>
                                        <div className={styles.routeDot} />
                                    </div>
                                    <div className={styles.routeLabel}>Rover</div>
                                </div>
                                <div className={styles.routeConnector}>
                                    <div className={styles.routeDots}>⋮</div>
                                </div>

                                {/* Waypoints */}
                                {waypoints.map((wp, index) => (
                                    <div key={wp.id}>
                                        <div
                                            className={`${styles.routeItem} ${styles.routeItemDraggable} ${
                                                dragIndex === index ? styles.routeItemDragging : ""
                                            } ${dragOverIndex === index ? styles.routeItemDragOver : ""}`}
                                            draggable
                                            onDragStart={() => setDragIndex(index)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverIndex(index);
                                            }}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className={styles.routeIcon}>
                                                {index === waypoints.length - 1 ? (
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                    >
                                                        <path
                                                            d="M12 21c0 0-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"
                                                            fill="#e74c3c"
                                                            stroke="#1e1e22"
                                                            strokeWidth="1"
                                                        />
                                                        <circle
                                                            cx="12"
                                                            cy="9"
                                                            r="2.5"
                                                            fill="#1e1e22"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <div className={styles.routeDot} />
                                                )}
                                            </div>
                                            <div className={styles.routeLabel}>{wp.label}</div>
                                            <button
                                                className={styles.routeRemove}
                                                onClick={() => removeWaypoint(index)}
                                            >
                                                ×
                                            </button>
                                            <div className={styles.routeDragHandle}>⠿</div>
                                        </div>
                                        {index < waypoints.length - 1 && (
                                            <div className={styles.routeConnector}>
                                                <div className={styles.routeDots}>⋮</div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <p className={styles.panelHint} style={{ marginTop: "8px" }}>
                                    Click more POIs to add to path
                                </p>
                                <div className={styles.routeActions}>
                                    <button className={styles.letsGoBtn} onClick={computeRoute}>
                                        Let's go
                                    </button>
                                </div>
                            </div>
                        )}

                    {directionsStep === "computing" && (
                        <div className={styles.computingState}>
                            <div className={styles.spinner} />
                            <span className={styles.panelHint}>Computing best path...</span>
                        </div>
                    )}

                    {directionsStep === "active" && (
                        <div className={styles.routeList}>
                            <div className={styles.routeItem}>
                                <div className={styles.routeIcon}>
                                    <div className={styles.routeDot} />
                                </div>
                                <div className={styles.routeLabel}>Rover</div>
                            </div>
                            {waypoints.map((wp, index) => (
                                <div key={wp.id}>
                                    <div className={styles.routeConnector}>
                                        <div className={styles.routeDots}>⋮</div>
                                        <span className={styles.segmentDistance}>
                                            {segmentDistances[index] ?? 0}m
                                        </span>
                                    </div>
                                    <div className={styles.routeItem}>
                                        <div className={styles.routeIcon}>
                                            {index === waypoints.length - 1 ? (
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M12 21c0 0-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"
                                                        fill="#e74c3c"
                                                        stroke="#1e1e22"
                                                        strokeWidth="1"
                                                    />
                                                    <circle cx="12" cy="9" r="2.5" fill="#1e1e22" />
                                                </svg>
                                            ) : (
                                                <div className={styles.routeDot} />
                                            )}
                                        </div>
                                        <div className={styles.routeLabel}>{wp.label}</div>
                                    </div>
                                </div>
                            ))}

                            <div className={styles.totalDistance}>
                                Total: {segmentDistances.reduce((a, b) => a + b, 0)}m
                            </div>

                            <button
                                className={styles.finishBtn}
                                onClick={cancelDirections}
                                style={{ marginTop: "8px" }}
                            >
                                End Navigation
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Autonomous LTV Panel (top-left) ── */}
            {mode === "autonomousLTV" && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="#6ee7b7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <path
                                d="M11 8a3 3 0 0 1 3 3"
                                stroke="#6ee7b7"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={styles.panelTitle}>Autonomous LTV Search</span>
                        <button className={styles.panelClose} onClick={cancelAutonomousLTV}>
                            ×
                        </button>
                    </div>

                    <p className={styles.panelHint}>Enter last known coordinates of the LTV</p>

                    <div className={styles.poiForm}>
                        <label className={styles.poiLabel}>X Coordinate</label>
                        <input
                            type="number"
                            className={styles.poiInput}
                            value={ltvX}
                            onChange={(e) => setLtvX(e.target.value)}
                            placeholder="e.g. -6090.0"
                            autoFocus
                        />
                        <label className={styles.poiLabel}>Y Coordinate</label>
                        <input
                            type="number"
                            className={styles.poiInput}
                            value={ltvY}
                            onChange={(e) => setLtvY(e.target.value)}
                            placeholder="e.g. -10485.6"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleLaunchAutonomy();
                                }
                            }}
                        />
                        <button
                            className={styles.finishBtn}
                            onClick={handleLaunchAutonomy}
                            disabled={!ltvX || !ltvY}
                            style={{ opacity: !ltvX || !ltvY ? 0.4 : 1 }}
                        >
                            Start Autonomous Navigation
                        </button>
                    </div>
                </div>
            )}

            {/* ── Manual mode confirmation overlay ── */}
            {showManualConfirm && (
                <div className={styles.confirmOverlay}>
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            Are you sure? This will stop autonomous navigation.
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.confirmCancelBtn}
                                onClick={() => setShowManualConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button className={styles.confirmStopBtn} onClick={confirmStopAutonomy}>
                                Stop Autonomy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Autonomous Navigation Status Panel (top-left) ── */}
            {isAutonomous && mode !== "autonomousLTV" && navState?.session && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="#6ee7b7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={styles.panelTitle}>Autonomous Navigation</span>
                        <button className={styles.panelClose} onClick={handleManualModeRequest}>
                            ×
                        </button>
                    </div>

                    <div className={styles.autoStatusBody}>
                        <div className={styles.autoPhaseRow}>
                            <span className={styles.autoLabel}>Phase</span>
                            <span className={styles.autoPhaseBadge}>
                                {navState.session.phase.replace(/_/g, " ")}
                            </span>
                        </div>

                        {navState.session.best_rssi > -Infinity && (
                            <div className={styles.autoPhaseRow}>
                                <span className={styles.autoLabel}>Best RSSI</span>
                                <span className={styles.autoValue}>
                                    {Math.round(navState.session.best_rssi)} dBm
                                </span>
                            </div>
                        )}

                        <div className={styles.autoPhaseRow}>
                            <span className={styles.autoLabel}>Pings</span>
                            <span className={styles.autoValue}>
                                {navState.session.ping_history.length}
                            </span>
                        </div>

                        {navState.session.current_target && (
                            <div className={styles.autoTargetBox}>
                                <span className={styles.autoLabel}>Current Target</span>
                                <span className={styles.autoTargetDesc}>
                                    {navState.session.current_target.description}
                                </span>
                            </div>
                        )}

                        {navState.session.projected_path.length > 0 && (
                            <div className={styles.autoPhaseRow}>
                                <span className={styles.autoLabel}>Planned Path</span>
                                <span className={styles.autoValue}>
                                    {navState.session.projected_path.length} waypoint
                                    {navState.session.projected_path.length !== 1 ? "s" : ""} ahead
                                </span>
                            </div>
                        )}
                    </div>

                    <button className={styles.stopAutonomyBtn} onClick={handleManualModeRequest}>
                        Stop Autonomous Navigation
                    </button>
                </div>
            )}

            {/* ── Info bar (bottom-left) ── */}
            <div className={styles.infoBar}>
                <span>
                    {points.length} point{points.length !== 1 ? "s" : ""} · {hazards.length} hazard
                    {hazards.length !== 1 ? "s" : ""}
                    {isAutonomous ? " · 🟢 Autonomous" : ""}
                </span>
            </div>

            {/* ── FAB button (bottom-right) ── */}
            <div className={styles.fabArea}>
                {mode === "navigate" && showAddMenu && (
                    <div className={styles.fabMenu}>
                        <button className={styles.fabMenuItem} onClick={handleAddPOI}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="3" fill="currentColor" />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </svg>
                            Add POI
                        </button>
                        <button className={styles.fabMenuItem} onClick={handlePlotHazard}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <polygon
                                    points="12,2 22,20 2,20"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="3 2"
                                />
                            </svg>
                            Plot Hazard
                        </button>
                    </div>
                )}
                <button
                    className={`${styles.fab} ${showAddMenu ? styles.fabOpen : ""} ${
                        mode === "addPOI" ? styles.fabActivePOI : ""
                    } ${
                        mode === "plotHazard" || mode === "hazardDetails" ? styles.fabActive : ""
                    } ${mode === "directions" ? styles.fabActiveDirections : ""} ${
                        mode === "autonomousLTV" ? styles.fabActiveDirections : ""
                    }`}
                    onClick={() => {
                        if (mode === "navigate") {
                            setShowAddMenu(!showAddMenu);
                        }
                    }}
                >
                    {mode === "navigate" && (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <line
                                x1="12"
                                y1="5"
                                x2="12"
                                y2="19"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="5"
                                y1="12"
                                x2="19"
                                y2="12"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                    {mode === "addPOI" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                        </svg>
                    )}
                    {(mode === "plotHazard" || mode === "hazardDetails") && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <polygon
                                points="12,2 22,20 2,20"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray="3 2"
                            />
                        </svg>
                    )}
                    {mode === "directions" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 12h4l3-9 4 18 3-9h4"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                    {mode === "autonomousLTV" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <path
                                d="M11 8a3 3 0 0 1 3 3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                </button>

                {/* Directions button */}
                <button
                    className={`${styles.fabSecondary} ${mode === "directions" ? styles.fabSecondaryActive : ""}`}
                    onClick={() => {
                        if (mode !== "directions") {
                            handleStartDirections();
                        }
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" fill="currentColor" />
                    </svg>
                </button>

                {/* Autonomous LTV button */}
                <button
                    className={`${styles.fabSecondary} ${
                        mode === "autonomousLTV" || isAutonomous ? styles.fabSecondaryActive : ""
                    }`}
                    onClick={() => {
                        if (isAutonomous) {
                            handleManualModeRequest();
                        } else if (mode !== "autonomousLTV") {
                            handleStartAutonomousLTV();
                        }
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                        />
                        <line
                            x1="16.5"
                            y1="16.5"
                            x2="21"
                            y2="21"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M11 8a3 3 0 0 1 3 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>

            {/* ── SVG canvas ── */}
            <svg
                ref={svgRef}
                className={`${styles.canvas} ${cursorClass}`}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <Grid spacing={50} viewBox={viewBox} />

                <line x1="-15" y1="0" x2="15" y2="0" stroke="#555" strokeWidth="1" />
                <line x1="0" y1="-15" x2="0" y2="15" stroke="#555" strokeWidth="1" />

                {/* Saved hazards */}
                {hazards.map((h) => (
                    <HazardShape key={h.id} hazard={h} onDelete={deleteHazard} />
                ))}

                {/* ── Autonomous Nav Overlays ── */}

                {/* Breadcrumb trail */}
                {navState?.session?.path_history && navState.session.path_history.length >= 2 && (
                    <polyline
                        points={navState.session.path_history.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#6ee7b7"
                        strokeWidth="1.5"
                        opacity="0.35"
                    />
                )}

                {/* Projected path */}
                {navState?.session?.projected_path &&
                    navState.session.projected_path.length >= 1 && (
                        <polyline
                            points={[
                                `${roverPosition.x},${roverPosition.y}`,
                                ...navState.session.projected_path.map((p) => `${p.x},${p.y}`),
                            ].join(" ")}
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                            opacity="0.6"
                        />
                    )}

                {/* Ping history markers */}
                {navState?.session?.ping_history?.map((ping, i) => {
                    const color =
                        ping.signal_category === "strong"
                            ? "#6ee7b7"
                            : ping.signal_category === "moderate"
                              ? "#fbbf24"
                              : ping.signal_category === "weak"
                                ? "#f97316"
                                : "#ef4444";
                    return (
                        <g key={`ping-${i}`}>
                            <circle
                                cx={ping.rover_position.x}
                                cy={ping.rover_position.y}
                                r="8"
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                opacity="0.6"
                            />
                            <circle
                                cx={ping.rover_position.x}
                                cy={ping.rover_position.y}
                                r="3"
                                fill={color}
                                opacity="0.8"
                            />
                            <text
                                x={ping.rover_position.x}
                                y={ping.rover_position.y - 14}
                                textAnchor="middle"
                                fill={color}
                                fontSize="8"
                                opacity="0.7"
                            >
                                {Math.round(ping.rssi)}dBm
                            </text>
                        </g>
                    );
                })}

                {/* Current autonomous target */}
                {navState?.session?.current_target && (
                    <g>
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={navState.session.current_target.position.y}
                            r="10"
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                        >
                            <animate
                                attributeName="r"
                                values="8;12;8"
                                dur="2s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="opacity"
                                values="1;0.4;1"
                                dur="2s"
                                repeatCount="indefinite"
                            />
                        </circle>
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={navState.session.current_target.position.y}
                            r="3"
                            fill="#6ee7b7"
                        />
                        <text
                            x={navState.session.current_target.position.x}
                            y={navState.session.current_target.position.y + 20}
                            textAnchor="middle"
                            fill="#6ee7b7"
                            fontSize="9"
                            opacity="0.8"
                        >
                            {navState.session.current_target.description}
                        </text>
                    </g>
                )}

                {/* Route path */}
                {routePath.length >= 2 && (
                    <g>
                        {routePath.map((p, i) => {
                            if (i === 0) return null;
                            return (
                                <line
                                    key={`route-${i}`}
                                    x1={routePath[i - 1].x}
                                    y1={routePath[i - 1].y}
                                    x2={p.x}
                                    y2={p.y}
                                    stroke="#6ee7b7"
                                    strokeWidth="2.5"
                                    strokeDasharray="10 6"
                                    opacity="0.8"
                                />
                            );
                        })}
                        {routePath.map((p, i) => (
                            <circle
                                key={`route-dot-${i}`}
                                cx={p.x}
                                cy={p.y}
                                r="4"
                                fill="#6ee7b7"
                                stroke="#1e1e22"
                                strokeWidth="1.5"
                            />
                        ))}
                    </g>
                )}

                {/* Pending hazard (waiting for details) */}
                {pendingHazard && (
                    <g>
                        <polygon
                            points={pendingHazard.points.map((p) => `${p.x},${p.y}`).join(" ")}
                            fill="rgba(255, 138, 117, 0.12)"
                            stroke="#ff8a75"
                            strokeWidth="2"
                        />
                        {pendingHazard.points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="5" fill="#ff8a75" />
                        ))}
                    </g>
                )}

                {/* Active hazard being drawn */}
                {activeHazard && (
                    <g>
                        <polyline
                            points={activeHazard.points.map((p) => `${p.x},${p.y}`).join(" ")}
                            fill="none"
                            stroke="#ff8a75"
                            strokeWidth="2"
                        />
                        {/* Dashed preview line from last point to cursor */}
                        {mousePos && activeHazard.points.length > 0 && (
                            <line
                                x1={activeHazard.points[activeHazard.points.length - 1].x}
                                y1={activeHazard.points[activeHazard.points.length - 1].y}
                                x2={mousePos.x}
                                y2={mousePos.y}
                                stroke="#ff8a75"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                opacity="0.5"
                            />
                        )}
                        {/* Dashed auto-close preview from last point back to first */}
                        {activeHazard.points.length >= 3 && (
                            <line
                                x1={activeHazard.points[activeHazard.points.length - 1].x}
                                y1={activeHazard.points[activeHazard.points.length - 1].y}
                                x2={activeHazard.points[0].x}
                                y2={activeHazard.points[0].y}
                                stroke="#ff8a75"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                                opacity="0.35"
                            />
                        )}
                        {activeHazard.points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="5" fill="#ff8a75" />
                        ))}
                    </g>
                )}

                {/* Map points — hovered marker renders last for z-ordering */}
                {points
                    .filter((p) => p.id !== hoveredPointId)
                    .map((p) => (
                        <Marker
                            key={p.id}
                            point={p}
                            roverPosition={roverPosition}
                            onDelete={deletePoint}
                            isHovered={false}
                            onHover={() => setHoveredPointId(p.id)}
                            onLeave={() => setHoveredPointId(null)}
                        />
                    ))}
                {points
                    .filter((p) => p.id === hoveredPointId)
                    .map((p) => (
                        <Marker
                            key={p.id}
                            point={p}
                            roverPosition={roverPosition}
                            onDelete={deletePoint}
                            isHovered={true}
                            onHover={() => setHoveredPointId(p.id)}
                            onLeave={() => setHoveredPointId(null)}
                        />
                    ))}

                {/* Pending POI (faded while editing) */}
                {pendingPOI && (
                    <g opacity="0.4">
                        <path
                            d={`M ${pendingPOI.x} ${pendingPOI.y}
                  C ${pendingPOI.x - 4} ${pendingPOI.y - 6}, ${pendingPOI.x - 14} ${pendingPOI.y - 16}, ${pendingPOI.x - 14} ${pendingPOI.y - 26}
                  A 14 14 0 1 1 ${pendingPOI.x + 14} ${pendingPOI.y - 26}
                  C ${pendingPOI.x + 14} ${pendingPOI.y - 16}, ${pendingPOI.x + 4} ${pendingPOI.y - 6}, ${pendingPOI.x} ${pendingPOI.y} Z`}
                            fill="#6ee7b7"
                            stroke="#1e1e22"
                            strokeWidth="2"
                        />
                        <circle cx={pendingPOI.x} cy={pendingPOI.y - 26} r="5" fill="#1e1e22" />
                        <text
                            x={pendingPOI.x}
                            y={pendingPOI.y + 14}
                            textAnchor="middle"
                            fill="#ccc"
                            fontSize="11"
                        >
                            {poiName || pendingPOI.label}:{" "}
                            {Math.round(
                                Math.sqrt(
                                    (pendingPOI.x - roverPosition.x) ** 2 +
                                        (pendingPOI.y - roverPosition.y) ** 2,
                                ),
                            )}
                            m
                        </text>
                    </g>
                )}

                {/* Rover */}
                <RoverIcon position={roverPosition} />
            </svg>
        </div>
    );
}
