import { useEffect, useId, useRef, useState } from "react";

import typo from "~/components/ui/typography.module.css";

interface GraphProps {
    value: number | null;
    label?: string;
    unit?: string;
    min?: number;
    max?: number;
    windowFraction?: number;
    borderTop?: boolean;
    borderBottom?: boolean;
    isWarning?: boolean;
    height?: number;
}

const MAX_POINTS = 20;
const W = 160;
const DEFAULT_H = 120;
const LINE_COLOR = "#A1A4AF";
const PAD = { top: 10, right: 12, bottom: 28, left: 44 };
const plotW = W - PAD.left - PAD.right;

export default function Graph({
    value,
    label,
    unit = "",
    min,
    max,
    windowFraction = 0.1,
    borderTop = true,
    borderBottom = true,
    isWarning,
    height: H = DEFAULT_H,
}: GraphProps) {
    const plotH = H - PAD.top - PAD.bottom;
    const clipId = useId();
    const statusLabel = isWarning !== undefined ? (isWarning ? "Unsafe" : "Safe") : null;
    const statusColor = isWarning ? "#F59095" : "#9DE4CE";
    const fillColor = isWarning ? "#5C5357" : "#6F7674";

    const [history, setHistory] = useState<(number | null)[]>([]);
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        const id = setInterval(() => {
            setHistory((prev) => {
                const next = [...prev, valueRef.current];
                return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, []);

    const values = history.filter((v): v is number => v !== null);

    const lastIdx = [...history].reverse().findIndex((v) => v !== null);
    const currentIdx = lastIdx === -1 ? -1 : history.length - 1 - lastIdx;
    const currentVal = currentIdx !== -1 ? (history[currentIdx] as number) : null;

    let yMin: number;
    let yMax: number;
    if (min !== undefined && max !== undefined) {
        const windowSize = (max - min) * windowFraction;
        const latest = value ?? currentVal ?? (values.length ? values[values.length - 1] : min);
        const windowIndex = Math.floor((latest - min) / windowSize);
        const maxBandIndex = Math.round(1 / windowFraction) - 1;
        const clampedIndex = Math.max(0, Math.min(maxBandIndex, windowIndex));
        yMin = min + clampedIndex * windowSize;
        yMax = yMin + windowSize;
    } else {
        yMin = min ?? (values.length ? Math.min(...values) : 0);
        yMax = max ?? (values.length ? Math.max(...values) : 1);
    }
    const yRange = yMax - yMin || 1;

    const xOf = (i: number) => PAD.left + (i / (MAX_POINTS - 1)) * plotW;
    const yOf = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * plotH;
    const baseline = yOf(yMin);

    const segments: string[] = [];
    const fills: string[] = [];
    let pathCmd = "";
    let segStartX = 0;
    let segLastX = 0;
    for (let i = 0; i < history.length; i++) {
        const v = history[i];
        if (v === null) {
            if (pathCmd) {
                segments.push(pathCmd);
                fills.push(`${pathCmd} L ${segLastX} ${baseline} L ${segStartX} ${baseline} Z`);
            }
            pathCmd = "";
            continue;
        }
        const x = xOf(i);
        const y = yOf(v);
        if (pathCmd === "") {
            pathCmd = `M ${x} ${y}`;
            segStartX = x;
        } else {
            pathCmd += ` L ${x} ${y}`;
        }
        segLastX = x;
    }
    if (pathCmd) {
        segments.push(pathCmd);
        fills.push(`${pathCmd} L ${segLastX} ${baseline} L ${segStartX} ${baseline} Z`);
    }

    const yTicks = [yMax, (yMax + yMin) / 2, yMin];
    const xTicks = [20, 15, 10, 5, 0];

    return (
        <div
            style={{
                background: "#2E2E32",
                borderTopLeftRadius: borderTop ? 12 : 0,
                borderTopRightRadius: borderTop ? 12 : 0,
                borderBottomLeftRadius: borderBottom ? 12 : 0,
                borderBottomRightRadius: borderBottom ? 12 : 0,
                padding: "10px",
                width: "100%",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
            }}
        >
            <svg width={W} height={H} style={{ overflow: "visible", flexShrink: 0 }}>
                <defs>
                    <clipPath id={clipId}>
                        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
                    </clipPath>
                </defs>

                <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="#3A3A41" rx={4} />
                {yTicks.map((tick, i) => (
                    <line
                        key={i}
                        x1={PAD.left}
                        y1={yOf(tick)}
                        x2={W - PAD.right}
                        y2={yOf(tick)}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={1}
                    />
                ))}

                {yTicks.map((tick, i) => (
                    <text
                        key={i}
                        x={PAD.left - 6}
                        y={yOf(tick) + 4}
                        textAnchor="end"
                        fill="#8b95a6"
                        fontSize={10}
                        fontFamily='"Be Vietnam Pro", sans-serif'
                    >
                        {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                    </text>
                ))}

                {xTicks.map((sec) => {
                    const idx = MAX_POINTS - 1 - sec;
                    if (idx < 0) return null;
                    return (
                        <text
                            key={sec}
                            x={xOf(idx)}
                            y={H - 4}
                            textAnchor="middle"
                            fill="#8b95a6"
                            fontSize={10}
                            fontFamily='"Be Vietnam Pro", sans-serif'
                        >
                            {sec}s
                        </text>
                    );
                })}
                <g clipPath={`url(#${clipId})`}>
                    {fills.map((d, i) => (
                        <path key={i} d={d} fill={fillColor} opacity={0.5} stroke="none" />
                    ))}

                    {segments.map((d, i) => (
                        <path
                            key={i}
                            d={d}
                            fill="none"
                            stroke={LINE_COLOR}
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    ))}

                    {currentVal !== null && (
                        <>
                            <line
                                x1={xOf(currentIdx)}
                                y1={PAD.top}
                                x2={xOf(currentIdx)}
                                y2={PAD.top + plotH}
                                stroke={LINE_COLOR}
                                strokeWidth={1}
                                strokeDasharray="3 3"
                                opacity={0.4}
                            />
                            <circle
                                cx={xOf(currentIdx)}
                                cy={yOf(currentVal)}
                                r={3.5}
                                fill={LINE_COLOR}
                            />
                        </>
                    )}
                </g>
            </svg>

            {label && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {statusLabel && (
                            <span className={typo.h5} style={{ color: statusColor }}>
                                {statusLabel}
                            </span>
                        )}
                        <span className={typo.h5} style={{ color: "#C5C9D2" }}>
                            {label}
                        </span>
                    </div>
                    {currentVal !== null && (
                        <span className={typo.h3} style={{ color: "#E8EBF2", lineHeight: 1 }}>
                            {currentVal.toFixed(1)}
                            <span className={typo.h5} style={{ color: "#C5C9D2", marginLeft: 6 }}>
                                {unit}
                            </span>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
