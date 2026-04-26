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
    trend: Trend;
    isWarning?: boolean;
}

function Metric({ label, value, unit, min, max, safeMin, safeMax, trend, isWarning }: MetricProps) {
    const statusLabel = isWarning ? "Critical" : "Normal";
    const statusColor = isWarning ? "#F59095" : "#9DE4CE";

    const pct = value !== null ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
    const safeMinPct = Math.min(1, Math.max(0, (safeMin - min) / (max - min)));
    const safeMaxPct = Math.min(1, Math.max(0, (safeMax - min) / (max - min)));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center", whiteSpace: "nowrap" }}>
                <span className={typo.p} style={{ color: statusColor, whiteSpace: "nowrap" }}>
                    {statusLabel}
                </span>
                <span className={typo.p} style={{ color: "#C5C9D2", whiteSpace: "nowrap" }}>
                    {label}
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <span className={typo.h5} style={{ color: "#E8EBF2", lineHeight: 1 }}>
                    {value !== null ? value.toFixed(2) : "--"}
                </span>
                <span className={typo.h5} style={{ color: "#E8EBF2" }}>
                    {unit}
                </span>
                <TrendArrow direction={trend} size={13} />
            </div>

            <div
                style={{ position: "relative", height: 19, display: "flex", alignItems: "center" }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: 8,
                        background: "#4a4a52",
                        borderRadius: 99,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        left: `${safeMinPct * 100}%`,
                        width: `${(safeMaxPct - safeMinPct) * 100}%`,
                        height: 8,
                        background: "rgba(255,255,255,0.3)",
                        borderRadius: 99,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        left: `${pct * 100}%`,
                        transform: "translateX(-50%)",
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        background: "#ffffff",
                        boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                    }}
                />
            </div>
        </div>
    );
}

interface CO2Props {
    co2Production: number | null;
    helmetCo2Pressure: number | null;
    co2ProductionWarning?: boolean;
    helmetCo2Warning?: boolean;
}

export default function CO2({
    co2Production,
    helmetCo2Pressure,
    co2ProductionWarning,
    helmetCo2Warning,
}: CO2Props) {
    const co2ProductionTrend = useTrend(co2Production);
    const helmetCo2Trend = useTrend(helmetCo2Pressure);

    return (
        <div
            style={{
                background: "#2e2e32",
                borderRadius: 10,
                padding: 16,
                display: "flex",
                gap: 19,
                width: "100%",
            }}
        >
            <Metric
                label="CO2 prod."
                value={co2Production}
                unit="psi/min"
                {...EVA_LIMITS.co2_production}
                trend={co2ProductionTrend}
                isWarning={co2ProductionWarning}
            />
            <Metric
                label="Helmet CO2 Press."
                value={helmetCo2Pressure}
                unit="psi"
                {...EVA_LIMITS.helmet_pressure_co2}
                trend={helmetCo2Trend}
                isWarning={helmetCo2Warning}
            />
        </div>
    );
}
