import { CX, CY, R, BG_PATH, FILL_PATH, TICK_PATHS, gaugePoint } from "~/components/ui/gaugeGeometry";

const OUTER_PATH =
    "M163.465 138.744C172.116 125.754 177.096 110.679 177.881 95.1055C178.666 79.5316 175.226 64.0347 167.925 50.2453C160.623 36.4559 149.73 24.884 136.39 16.7471C123.051 8.61024 107.758 4.20927 92.122 4.00728C76.4859 3.80529 61.0843 7.80977 47.5378 15.5993C33.9912 23.3889 22.8006 34.6755 15.1435 48.2717C7.48628 61.8678 3.64566 77.2707 4.0257 92.8597C4.40575 108.449 8.99241 123.647 17.3031 136.856";

const OCX = 90.97;
const OCY = 90.85;

// Normal mode: inner gauge slightly larger than its base 137×122 viewBox
const INNER_SCALE = 1.1;
const INNER_W = 137 * INNER_SCALE; // 150.7
const INNER_H = 122 * INNER_SCALE; // 134.2
const INNER_LEFT = OCX - CX * INNER_SCALE; // ≈ 23.73
const INNER_TOP = OCY - CY * INNER_SCALE;  // ≈ 21.81

// Radius of OUTER_PATH arc in the 182×143 coordinate space
const R_OUTER = 86.87;

// Swap mode: gauge at outer arc radius, centered at OCX/OCY (div overflows container,
// but arc content stays within the 182×143 bounds since the arc itself fits)
const OUTER_SCALE = R_OUTER / R;
const OUTER_W = 137 * OUTER_SCALE;
const OUTER_H = 122 * OUTER_SCALE;
const OUTER_LEFT = OCX - CX * OUTER_SCALE;
const OUTER_TOP = OCY - CY * OUTER_SCALE;

// Swap mode: static ring shrunk so its arc radius matches the inner gauge arc,
// centered at OCX/OCY (uniform scale → no aspect-ratio distortion)
const INNER_RING_SCALE = (R * INNER_SCALE) / R_OUTER;
const INNER_RING_W = 182 * INNER_RING_SCALE;
const INNER_RING_H = 143 * INNER_RING_SCALE;
const INNER_RING_LEFT = OCX * (1 - INNER_RING_SCALE);
const INNER_RING_TOP = OCY * (1 - INNER_RING_SCALE);

interface OxygenProps {
    levelTank1: number; // 0–100
    levelTank2: number; // 0–100
    primaryActive?: boolean; // true (default) = tank 1, false = tank 2
    remaining?: string;
}

export default function Oxygen({
    levelTank1,
    levelTank2,
    primaryActive,
    remaining = "8:00:00 Remaining",
}: OxygenProps) {
    const clampedTank1 = Math.min(100, Math.max(0, levelTank1));
    const clampedTank2 = Math.min(100, Math.max(0, levelTank2));
    const tank1Empty = primaryActive === false;
    const clamped = tank1Empty ? clampedTank2 : clampedTank1;
    const isLow = clamped < 50;
    const fillColor = isLow ? "#F59095" : "#E9FFF6";
    const fillOpacity = isLow ? 0.5 : 0.415;
    const pct = clamped / 100;
    const indicator = gaugePoint(pct);

    const gaugeArc = (w: number, h: number) => (
        <svg viewBox="0 0 137 122" width={w} height={h} style={{ overflow: "visible" }}>
            <path d={BG_PATH} fill="none" stroke="#4F4F59" strokeWidth="12" strokeLinecap="round" />
            <path
                d={FILL_PATH}
                fill="none"
                stroke={fillColor}
                strokeWidth="12"
                strokeLinecap="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={1 - pct}
                opacity={fillOpacity}
            />
            {TICK_PATHS.map((d) => (
                <path key={d} d={d} stroke="#7B7B84" strokeWidth="3" strokeLinecap="round" />
            ))}
            <circle cx={indicator.x} cy={indicator.y} r={5} fill="white" />
        </svg>
    );

    const staticRing = (w: number, h: number, top: number, left: number) => (
        <svg
            viewBox="0 0 182 143"
            width={w}
            height={h}
            style={{ position: "absolute", top, left }}
        >
            <path
                d={OUTER_PATH}
                fill="none"
                stroke={isLow ? "#9C8080" : "#4F4F59"}
                strokeWidth="8"
                strokeLinecap="round"
                opacity={isLow ? 0.35 : 1}
            />
        </svg>
    );

    return (
        <div
            style={{
                background: "#3a3a41",
                borderRadius: "12px",
                padding: "4px 20px 20px",
                width: "100%",
                maxWidth: 240,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
            }}
        >
            {/* Gauge area */}
            <div style={{ position: "relative", width: 182, height: 143 }}>
                {tank1Empty ? (
                    <>
                        {/* Tank 2 active: gauge at outer arc position */}
                        <div style={{ position: "absolute", top: OUTER_TOP, left: OUTER_LEFT }}>
                            {gaugeArc(OUTER_W, OUTER_H)}
                        </div>

                        {/* Static ring shrunk to inner gauge position */}
                        {staticRing(INNER_RING_W, INNER_RING_H, INNER_RING_TOP, INNER_RING_LEFT)}
                    </>
                ) : (
                    <>
                        {/* Tank 1 active: static ring at outer position */}
                        {staticRing(182, 143, 0, 0)}

                        {/* Gauge at inner position */}
                        <div style={{ position: "absolute", top: INNER_TOP, left: INNER_LEFT }}>
                            {gaugeArc(INNER_W, INNER_H)}
                        </div>
                    </>
                )}

                {/* Text centered at outer arc center */}
                <div
                    style={{
                        position: "absolute",
                        left: OCX,
                        top: OCY,
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                    }}
                >
                    <span
                        style={{
                            fontFamily: '"Be Vietnam Pro", sans-serif',
                            fontSize: 26,
                            fontWeight: 500,
                            color: "#ffffff",
                            lineHeight: 1,
                        }}
                    >
                        {clamped.toFixed(0)}%
                    </span>
                    <span
                        style={{
                            fontFamily: '"Be Vietnam Pro", sans-serif',
                            fontSize: 16,
                            fontWeight: 400,
                            color: "#c5c9d2",
                            letterSpacing: "0.18px",
                        }}
                    >
                        {tank1Empty ? "Tank 2" : "Tank 1"}
                    </span>
                </div>
            </div>

            {/* Oxygen storage label + remaining time */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 11,
                    alignItems: "center",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <rect x="8" y="4" width="8" height="16" rx="3" fill="#c5c9d2" opacity="0.28" />
                            <rect x="10" y="2" width="4" height="4" rx="1" fill="#c5c9d2" opacity="0.28" />
                            <path d="M10 9H14M10 13H14" stroke="#9de4ce" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span
                        style={{
                            fontFamily: '"Be Vietnam Pro", sans-serif',
                            fontSize: 18,
                            fontWeight: 400,
                            color: "#c5c9d2",
                            letterSpacing: "0.18px",
                        }}
                    >
                        Oxygen storage
                    </span>
                </div>
                {remaining && (
                    <div style={{ background: isLow ? "#4c424a" : "#333734", borderRadius: 8, padding: "5px 10px" }}>
                        <span
                            style={{
                                fontFamily: '"Be Vietnam Pro", sans-serif',
                                fontSize: 16,
                                color: isLow ? "#F59095" : "#9de4ce",
                                letterSpacing: "0.18px",
                            }}
                        >
                            {remaining}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}