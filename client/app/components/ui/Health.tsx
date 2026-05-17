import { EVA_LIMITS } from "~/constants/telemetryLimits";
import typo from "~/components/ui/typography.module.css";
import { TrendArrow, useTrend, type Trend } from "~/components/ui/trend";

interface MetricProps {
    label: string;
    value: number | null;
    unit: string;
    min: number;
    max: number;
    safeMin: number;
    safeMax: number;
    trend?: Trend;
    isWarning?: boolean;
}

const TICKS = [1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8];

function Metric({
    label,
    value,
    unit,
    min,
    max,
    safeMin,
    safeMax,
    trend = "up",
    isWarning,
}: MetricProps) {
    const statusLabel = isWarning ? "Critical" : "Normal";
    const statusColor = isWarning ? "#F59095" : "#9DE4CE";
    const safeBarColor = isWarning ? "rgba(245,144,149,0.5)" : "#758181";
    const pct = value !== null ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
    const safeMinPct = Math.min(1, Math.max(0, (safeMin - min) / (max - min)));
    const safeMaxPct = Math.min(1, Math.max(0, (safeMax - min) / (max - min)));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            {/* Status + label */}
            <div style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                <span className={typo.h5} style={{ color: statusColor }}>
                    {statusLabel}
                </span>
                <span className={typo.h5} style={{ color: "#C5C9D2" }}>
                    {label}
                </span>
            </div>

            {/* Value + trend */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className={typo.h3} style={{ color: "#E8EBF2", lineHeight: 1 }}>
                    {value !== null ? value.toFixed(0) : "--"}
                </span>
                <span className={typo.h3} style={{ color: "#E8EBF2" }}>
                    {unit}
                </span>
                <TrendArrow direction={trend} />
            </div>

            {/* Horizontal bar with ticks and indicator */}
            <div
                style={{
                    position: "relative",
                    width: 180,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {/* Track */}
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: 10,
                        background: "#4a4a52",
                        borderRadius: 99,
                    }}
                />

                {/* Safe zone */}
                <div
                    style={{
                        position: "absolute",
                        left: `${safeMinPct * 100}%`,
                        width: `${(safeMaxPct - safeMinPct) * 100}%`,
                        height: 12,
                        background: safeBarColor,
                        borderRadius: 99,
                    }}
                />

                {/* Ticks */}
                {TICKS.map((t, i) => (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            left: `${t * 100}%`,
                            width: 2,
                            height: 5,
                            background: "#7B7B84",
                            borderRadius: 1,
                            transform: "translateX(-50%)",
                        }}
                    />
                ))}

                {/* Indicator circle */}
                <div
                    style={{
                        position: "absolute",
                        left: `${pct * 100}%`,
                        transform: "translateX(-50%)",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#ffffff",
                        boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                    }}
                />
            </div>
        </div>
    );
}

interface HealthProps {
    bodyTemp: number | null;
    heartRate: number | null;
    bodyTempWarning?: boolean;
    heartRateWarning?: boolean;
}

export default function Health({
    bodyTemp,
    heartRate,
    bodyTempWarning,
    heartRateWarning,
}: HealthProps) {
    const bodyTempTrend = useTrend(bodyTemp);
    const heartRateTrend = useTrend(heartRate);

    return (
        <div style={{ display: "flex", gap: 24 }}>
            <Metric
                label="Body Temp"
                value={bodyTemp}
                unit="°"
                {...EVA_LIMITS.temperature}
                trend={bodyTempTrend}
                isWarning={bodyTempWarning}
            />
            <Metric
                label="Heart Rate"
                value={heartRate}
                unit="bpm"
                {...EVA_LIMITS.heart_rate}
                trend={heartRateTrend}
                isWarning={heartRateWarning}
            />
        </div>
    );
}
