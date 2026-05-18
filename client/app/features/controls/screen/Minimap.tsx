import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./Minimap.module.css";
import { useMapContext } from "~/contexts/MapContext";
import { useTelemetry } from "~/hooks/useTelemetry";
import { Grid } from "~/features/map/interactive-map/map-components/Grid";
import { RoverIcon } from "~/features/map/interactive-map/map-components/RoverIcon";
import { AstronautIcon } from "~/features/map/interactive-map/map-components/AstronautIcon";
import type { ViewBox, RoverPosition, MapPoint } from "~/types/map";

export default function Minimap() {
    const { points, hazards, savedPingHistory, savedSearchArea, navState } = useMapContext();
    const telemetry = useTelemetry();

    const pos = telemetry.getRoverPosition() ?? { x: 0, y: 0, z: 0 };
    const roverPosition: RoverPosition = { ...pos, heading: telemetry.getRoverHeading() ?? 0 };
    const eva1Imu = telemetry.getEvaImu("eva1");
    const eva2Imu = telemetry.getEvaImu("eva2");

    const isAutonomous = navState?.autonomous_driving ?? false;

    const svgRef = useRef<SVGSVGElement>(null);
    const [viewBox, setViewBox] = useState<ViewBox>({ x: -500, y: -400, w: 1000, h: 800 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; vx: number; vy: number }>({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    });

    // Auto-center on rover when it moves significantly
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

    // Prevent scroll zoom on the canvas
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => e.preventDefault();
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, []);

    // ── SVG coordinate conversion ──
    const getSVGCoords = useCallback(
        (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
            const svg = svgRef.current;
            if (!svg) return { x: 0, y: 0 };
            const rect = svg.getBoundingClientRect();
            const scaleX = viewBox.w / rect.width;
            const scaleY = viewBox.h / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX + viewBox.x,
                y: viewBox.y + viewBox.h - (e.clientY - rect.top) * scaleY,
            };
        },
        [viewBox],
    );

    // ── Pan ──
    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isPanning) return;
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
            y: panStart.current.vy + dy * scaleY,
        }));
    };

    const handleMouseUp = () => setIsPanning(false);
    const handleMouseLeave = () => setIsPanning(false);

    // ── Zoom ──
    const ZOOM_FACTOR = 0.25;
    const MIN_VIEW = 200;
    const MAX_VIEW = 8000;

    const zoomBy = useCallback((direction: 1 | -1) => {
        setViewBox((prev) => {
            const factor = direction === 1 ? 1 - ZOOM_FACTOR : 1 + ZOOM_FACTOR;
            const newW = Math.min(MAX_VIEW, Math.max(MIN_VIEW, prev.w * factor));
            const newH = Math.min(MAX_VIEW, Math.max(MIN_VIEW, prev.h * factor));
            return {
                x: prev.x + (prev.w - newW) / 2,
                y: prev.y + (prev.h - newH) / 2,
                w: newW,
                h: newH,
            };
        });
    }, []);

    // ── Hover state for tooltips ──
    const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
    const [hoveredPingIndex, setHoveredPingIndex] = useState<number | null>(null);
    const [isRoverHovered, setIsRoverHovered] = useState(false);
    const [hoveredEva, setHoveredEva] = useState<"EVA1" | "EVA2" | null>(null);

    // ── Tooltip helper ──
    const renderTooltip = (
        px: number,
        py: number,
        lines: { text: string; color: string }[],
    ) => {
        const tw = 170;
        const lineH = 16;
        const th = lines.length * lineH + 12;
        const tx = px - tw / 2;
        const ty = py - 44 - th;
        return (
            <g pointerEvents="none">
                <rect x={tx} y={ty} width={tw} height={th} rx="5" fill="#1e1e22" stroke="#444" strokeWidth="1" />
                <polygon
                    points={`${px - 6},${ty + th} ${px + 6},${ty + th} ${px},${ty + th + 7}`}
                    fill="#1e1e22"
                    stroke="#444"
                    strokeWidth="1"
                />
                <line x1={px - 6} y1={ty + th} x2={px + 6} y2={ty + th} stroke="#1e1e22" strokeWidth="2" />
                {lines.map((l, i) => (
                    <text
                        key={i}
                        x={px}
                        y={ty + 10 + lineH * (i + 1)}
                        textAnchor="middle"
                        fill={l.color}
                        fontSize="10"
                    >
                        {l.text}
                    </text>
                ))}
            </g>
        );
    };

    return (
        <div className={styles.wrapper}>
            {/* ── SVG canvas ── */}
            <svg
                ref={svgRef}
                className={`${styles.canvas} ${isPanning ? styles.grabbing : styles.grab}`}
                viewBox={`${viewBox.x} ${-viewBox.y - viewBox.h} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <Grid spacing={50} viewBox={viewBox} />

                {/* Origin crosshair */}
                <line x1="-15" y1="0" x2="15" y2="0" stroke="#555" strokeWidth="1" />
                <line x1="0" y1="-15" x2="0" y2="15" stroke="#555" strokeWidth="1" />

                {/* ── Hazards ── */}
                {hazards
                    .filter((h) => h.closed)
                    .map((h) => (
                        <g key={h.id}>
                            <polygon
                                points={h.points.map((p) => `${p.x},${-p.y}`).join(" ")}
                                fill="rgba(255,138,117,0.1)"
                                stroke="#ff8a75"
                                strokeWidth="1.5"
                            />
                            {(() => {
                                const cx = h.points.reduce((s, p) => s + p.x, 0) / h.points.length;
                                const cy = h.points.reduce((s, p) => s + p.y, 0) / h.points.length;
                                return (
                                    <text
                                        x={cx}
                                        y={-cy + 4}
                                        textAnchor="middle"
                                        fill="#ff8a75"
                                        fontSize="8"
                                        opacity="0.7"
                                    >
                                        {h.types.join(", ")}
                                    </text>
                                );
                            })()}
                        </g>
                    ))}

                {/* ── Search area donut ── */}
                {savedSearchArea &&
                    (savedSearchArea.radius_min_m !== 0 || savedSearchArea.radius_max_m !== 0) && (
                        <g>
                            <circle
                                cx={savedSearchArea.center.x}
                                cy={-savedSearchArea.center.y}
                                r={savedSearchArea.radius_max_m}
                                fill="rgba(110,231,183,0.05)"
                                stroke="#6ee7b7"
                                strokeWidth="1.5"
                                strokeDasharray="8 4"
                                opacity="0.4"
                            />
                            {savedSearchArea.radius_min_m > 0 && (
                                <circle
                                    cx={savedSearchArea.center.x}
                                    cy={-savedSearchArea.center.y}
                                    r={savedSearchArea.radius_min_m}
                                    fill="#1e1e22"
                                    stroke="#6ee7b7"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    opacity="0.3"
                                />
                            )}
                            <circle
                                cx={savedSearchArea.center.x}
                                cy={-savedSearchArea.center.y}
                                r="4"
                                fill="none"
                                stroke="#6ee7b7"
                                strokeWidth="1"
                                opacity="0.5"
                            />
                            <text
                                x={savedSearchArea.center.x}
                                y={-savedSearchArea.center.y - savedSearchArea.radius_max_m - 8}
                                textAnchor="middle"
                                fill="#6ee7b7"
                                fontSize="9"
                                opacity="0.55"
                            >
                                Search Area (
                                {savedSearchArea.radius_min_m > 0
                                    ? `${Math.round(savedSearchArea.radius_min_m)}–${Math.round(savedSearchArea.radius_max_m)}m`
                                    : `${Math.round(savedSearchArea.radius_max_m)}m`}
                                )
                            </text>
                        </g>
                    )}

                {/* ── Path history (breadcrumbs) ── */}
                {navState?.session?.path_history && navState.session.path_history.length >= 2 && (
                    <polyline
                        points={navState.session.path_history.map((p) => `${p.x},${-p.y}`).join(" ")}
                        fill="none"
                        stroke="#6ee7b7"
                        strokeWidth="1.5"
                        opacity="0.3"
                    />
                )}

                {/* ── Projected path ── */}
                {isAutonomous &&
                    navState?.session?.projected_path &&
                    navState.session.projected_path.length >= 1 && (
                        <polyline
                            points={[
                                `${roverPosition.x},${-roverPosition.y}`,
                                ...navState.session.projected_path.map((p) => `${p.x},${-p.y}`),
                            ].join(" ")}
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                            opacity="0.6"
                        />
                    )}

                {/* ── Ping history ── */}
                {savedPingHistory.map((ping, i) => {
                    const color =
                        ping.signal_category === "strong"
                            ? "#6ee7b7"
                            : ping.signal_category === "moderate"
                              ? "#fbbf24"
                              : ping.signal_category === "weak"
                                ? "#f97316"
                                : "#ef4444";
                    const isHovered = hoveredPingIndex === i;
                    const px = ping.rover_position.x;
                    const py = -ping.rover_position.y;
                    const rangeByCategory: Record<string, [number, number]> = {
                        strong: [0, 50],
                        moderate: [50, 200],
                        weak: [200, 500],
                        very_weak: [500, 1000],
                    };
                    const [rMin, rMax] = rangeByCategory[ping.signal_category] ?? [0, 0];
                    return (
                        <g
                            key={`ping-${i}`}
                            onMouseEnter={() => setHoveredPingIndex(i)}
                            onMouseLeave={() => setHoveredPingIndex(null)}
                            style={{ cursor: "default" }}
                        >
                            <circle cx={px} cy={py} r="8" fill="transparent" stroke={color} strokeWidth="2" opacity="0.55" />
                            <circle cx={px} cy={py} r="3" fill={color} opacity="0.8" />
                            <text x={px} y={py - 12} textAnchor="middle" fill={color} fontSize="7" opacity="0.65">
                                {Math.round(ping.rssi)}dBm
                            </text>
                            {isHovered && (
                                <g pointerEvents="none">
                                    <circle cx={px} cy={py} r={rMax} fill={`${color}0d`} stroke={color} strokeWidth="1.5" strokeDasharray="8 4" opacity="0.45" />
                                    {rMin > 0 && (
                                        <circle cx={px} cy={py} r={rMin} fill="#1e1e2240" stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.35" />
                                    )}
                                    {renderTooltip(px, py, [
                                        { text: `x: ${Math.round(ping.rover_position.x)}, y: ${Math.round(ping.rover_position.y)}`, color: color },
                                        { text: `${Math.round(ping.rssi)} dBm · ${ping.signal_category.replace("_", " ")}`, color: "#aaa" },
                                        { text: `${rMin}–${rMax} m range`, color: "#888" },
                                    ])}
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* ── Current autonomous target ── */}
                {isAutonomous && navState?.session?.current_target && (
                    <g>
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={-navState.session.current_target.position.y}
                            r="10"
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                        >
                            <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={-navState.session.current_target.position.y}
                            r="3"
                            fill="#6ee7b7"
                        />
                        <text
                            x={navState.session.current_target.position.x}
                            y={-navState.session.current_target.position.y + 18}
                            textAnchor="middle"
                            fill="#6ee7b7"
                            fontSize="8"
                            opacity="0.75"
                        >
                            {navState.session.current_target.description}
                        </text>
                    </g>
                )}

                {/* ── POI markers (read-only, no delete) ── */}
                {points
                    .filter((p) => p.type === "poi")
                    .map((p) => {
                        const isHovered = hoveredPointId === p.id;
                        const sy = -p.y;
                        const dx = p.x - roverPosition.x;
                        const dy = p.y - roverPosition.y;
                        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
                        return (
                            <g
                                key={p.id}
                                onMouseEnter={() => setHoveredPointId(p.id)}
                                onMouseLeave={() => setHoveredPointId(null)}
                                style={{ cursor: "default" }}
                            >
                                <path
                                    d={`M ${p.x} ${sy}
                                        C ${p.x - 4} ${sy - 6}, ${p.x - 14} ${sy - 16}, ${p.x - 14} ${sy - 26}
                                        A 14 14 0 1 1 ${p.x + 14} ${sy - 26}
                                        C ${p.x + 14} ${sy - 16}, ${p.x + 4} ${sy - 6}, ${p.x} ${sy} Z`}
                                    fill="#6ee7b7"
                                    stroke="#1e1e22"
                                    strokeWidth="2"
                                />
                                <circle cx={p.x} cy={sy - 26} r="5" fill="#1e1e22" />
                                <text x={p.x} y={sy + 13} textAnchor="middle" fill="#ccc" fontSize="9">
                                    {p.label}: {distance}m
                                </text>
                                {isHovered &&
                                    renderTooltip(p.x, sy - 26, [
                                        { text: `x: ${Math.round(p.x)}, y: ${Math.round(p.y)}`, color: "#6ee7b7" },
                                        ...(p.description ? [{ text: p.description, color: "#ccc" }] : []),
                                    ])}
                            </g>
                        );
                    })}

                {/* ── Rover ── */}
                <RoverIcon
                    position={roverPosition}
                    onHover={() => setIsRoverHovered(true)}
                    onLeave={() => setIsRoverHovered(false)}
                />
                {isRoverHovered &&
                    renderTooltip(roverPosition.x, -roverPosition.y - 30, [
                        { text: `x: ${Math.round(roverPosition.x)}, y: ${Math.round(roverPosition.y)}`, color: "#6ee7b7" },
                    ])}

                {/* ── EVA astronauts ── */}
                {([
                    { imu: eva1Imu, label: "EVA1" as const, color: "#93c5fd" },
                    { imu: eva2Imu, label: "EVA2" as const, color: "#f9a8d4" },
                ] as const).map(({ imu, label, color }) => {
                    if (!imu) return null;
                    return (
                        <g key={label}>
                            <AstronautIcon
                                x={imu.posx}
                                y={imu.posy}
                                heading={imu.heading}
                                label={label}
                                onHover={() => setHoveredEva(label)}
                                onLeave={() => setHoveredEva(null)}
                            />
                            {hoveredEva === label &&
                                renderTooltip(imu.posx, -imu.posy - 24, [
                                    { text: `x: ${Math.round(imu.posx)}, y: ${Math.round(imu.posy)}`, color: color },
                                ])}
                        </g>
                    );
                })}
            </svg>

            {/* ── Zoom controls (bottom-right) ── */}
            <div className={styles.zoomControls}>
                <button className={styles.zoomBtn} onClick={() => zoomBy(1)} title="Zoom in">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                <button className={styles.zoomBtn} onClick={() => zoomBy(-1)} title="Zoom out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <span className={styles.northBadge}>N ↑</span>
        </div>
    );
}
