import { CX, CY, BG_PATH, FILL_PATH, TICK_PATHS, gaugePoint } from "~/components/ui/gaugeGeometry";

// Outer ring — same angular geometry as EVACoolant, scaled up (182×143)
const OUTER_PATH =
    "M163.465 138.744C172.116 125.754 177.096 110.679 177.881 95.1055C178.666 79.5316 175.226 64.0347 167.925 50.2453C160.623 36.4559 149.73 24.884 136.39 16.7471C123.051 8.61024 107.758 4.20927 92.122 4.00728C76.4859 3.80529 61.0843 7.80977 47.5378 15.5993C33.9912 23.3889 22.8006 34.6755 15.1435 48.2717C7.48628 61.8678 3.64566 77.2707 4.0257 92.8597C4.40575 108.449 8.99241 123.647 17.3031 136.856";

// Center of the outer arc in the 182×143 coordinate space
const OCX = 90.97;
const OCY = 90.85;

// Inner gauge rendered at 1.1× scale — offset keeps arc centers aligned
const INNER_SCALE = 1.1;
const INNER_W = 137 * INNER_SCALE; // 150.7
const INNER_H = 122 * INNER_SCALE; // 134.2
const INNER_LEFT = OCX - CX * INNER_SCALE; // ≈ 23.73
const INNER_TOP = OCY - CY * INNER_SCALE;  // ≈ 21.81

interface OxygenProps {
    level: number; // 0–100
    tankLabel?: string;
    remaining?: string;
}

export default function Oxygen({
    level,
    tankLabel = "Tank 1",
    remaining = "8:00:00 Remaining",
}: OxygenProps) {
    const clamped = Math.min(100, Math.max(0, level));
    const isLow = clamped < 50;
    const fillColor = isLow ? "#A27077" : "#C3D2CE";
    const pct = clamped / 100;
    const indicator = gaugePoint(pct);

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
                {/* Outer background arc */}
                <svg
                    viewBox="0 0 182 143"
                    width="182"
                    height="143"
                    style={{ position: "absolute", top: 0, left: 0 }}
                >
                    <path
                        d={OUTER_PATH}
                        fill="none"
                        stroke="#4F4F59"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                </svg>

                {/* Inner EVACoolant gauge */}
                <div
                    style={{
                        position: "absolute",
                        top: INNER_TOP,
                        left: INNER_LEFT,
                        width: INNER_W,
                        height: INNER_H,
                    }}
                >
                    <svg
                        viewBox="0 0 137 122"
                        width={INNER_W}
                        height={INNER_H}
                        style={{ overflow: "visible" }}
                    >
                        <path
                            d={BG_PATH}
                            fill="none"
                            stroke="#4F4F59"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                        <path
                            d={FILL_PATH}
                            fill="none"
                            stroke={fillColor}
                            strokeWidth="12"
                            strokeLinecap="round"
                            pathLength="1"
                            strokeDasharray="1"
                            strokeDashoffset={1 - pct}
                            opacity={0.4}
                        />
                        {TICK_PATHS.map((d) => (
                            <path
                                key={d}
                                d={d}
                                stroke="#7B7B84"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                        ))}
                        <circle cx={indicator.x} cy={indicator.y} r={5} fill="white" />
                    </svg>
                </div>

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
                        {tankLabel}
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
                            <rect
                                x="8"
                                y="4"
                                width="8"
                                height="16"
                                rx="3"
                                fill="#c5c9d2"
                                opacity="0.28"
                            />
                            <rect
                                x="10"
                                y="2"
                                width="4"
                                height="4"
                                rx="1"
                                fill="#c5c9d2"
                                opacity="0.28"
                            />
                            <path
                                d="M10 9H14M10 13H14"
                                stroke="#9de4ce"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
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
                    <div style={{ background: "#333734", borderRadius: 8, padding: "5px 10px" }}>
                        <span
                            style={{
                                fontFamily: '"Be Vietnam Pro", sans-serif',
                                fontSize: 16,
                                color: "#9de4ce",
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
