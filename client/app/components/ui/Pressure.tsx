import typo from "~/components/ui/typography.module.css";

interface PressureProps {
    value: number | null;
    min: number;
    max: number;
    safeMin?: number;
    safeMax?: number;
    label?: string;
    unit?: string;
}

const RADIUS = 100;

function arcPoint(r: number, pct: number) {
    const theta = Math.PI * (1 - pct);
    return { x: r * Math.cos(theta), y: -r * Math.sin(theta) };
}

function arcPath(r: number, pct1: number, pct2: number) {
    const p1 = arcPoint(r, pct1);
    const p2 = arcPoint(r, pct2);
    const largeArc = pct2 - pct1 > 0.5 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

function valueToPct(value: number, min: number, max: number) {
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export default function Pressure({
    value,
    min,
    max,
    safeMin,
    safeMax,
    label,
    unit = "psi",
}: PressureProps) {
    const pct = value !== null && Number.isFinite(value) ? valueToPct(value, min, max) : null;
    const safeMinPct = safeMin !== undefined ? valueToPct(safeMin, min, max) : 0.25;
    const safeMaxPct = safeMax !== undefined ? valueToPct(safeMax, min, max) : 0.75;

    const indicator = pct !== null ? arcPoint(RADIUS, pct) : null;

    const isSafe =
        value != null &&
        Number.isFinite(value) &&
        safeMin !== undefined &&
        safeMax !== undefined &&
        (value as number) >= safeMin &&
        (value as number) <= safeMax;
    return (
        <div
            style={{
                position: "relative",
                width: 208,
                height: 150,
            }}
        >
            <svg viewBox="0 0 208 140" width="208" height="140" style={{ overflow: "hidden" }}>
                <g transform="translate(104, 130)">
                    {/* Background arc */}
                    <path
                        d={arcPath(RADIUS, 0, 1)}
                        fill="none"
                        stroke="#4F4F59"
                        strokeWidth={8}
                        strokeLinecap="round"
                    />

                    {/* Safe zone arc */}
                    <path
                        d={arcPath(RADIUS, safeMinPct, safeMaxPct)}
                        fill="none"
                        stroke={isSafe ? "#74857F" : "#F59095"}
                        strokeOpacity={0.5}
                        strokeWidth={12}
                        strokeLinecap="round"
                    />

                    {/* Tick marks */}
                    {[
                        "M -94.236 -39.033 L -90.540 -37.503",
                        "M -72.125 -72.125 L -69.297 -69.297",
                        "M -39.033 -94.236 L -37.503 -90.540",
                        "M 0 -102 L 0 -98",
                        "M 39.033 -94.236 L 37.503 -90.540",
                        "M 72.125 -72.125 L 69.297 -69.297",
                        "M 94.236 -39.033 L 90.540 -37.503",
                    ].map((d) => (
                        <path
                            key={d}
                            d={d}
                            stroke="#7B7B84"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    ))}

                    {/* Indicator circle */}
                    {indicator && <circle cx={indicator.x} cy={indicator.y} r={6} fill="#E8EBF2" />}
                </g>
            </svg>

            <div
                style={{
                    position: "absolute",
                    top: 100,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                }}
            >
                <span className={typo.h3} style={{ color: "#F1F2F5", lineHeight: 1 }}>
                    {value !== null && Number.isFinite(value) ? (value as number).toFixed(1) : "--"}
                    <span className={typo.h5} style={{ color: "#F1F2F5", marginLeft: 6 }}>
                        {unit}
                    </span>
                </span>

                {label && (
                    <span className={typo.h5} style={{ color: "#C5C9D2" }}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
