import typo from "~/components/ui/typography.module.css";
import { CX, CY, BG_PATH, FILL_PATH, TICK_PATHS, gaugePoint } from "~/components/ui/gaugeGeometry";

interface EVACoolantProps {
    coolantStorage: number | null;
    liquidPressure: number | null;
    gasPressure: number | null;
    liquidWarning?: boolean;
    gasWarning?: boolean;
}

export default function EVACoolant({
    coolantStorage,
    liquidPressure,
    gasPressure,
    liquidWarning,
    gasWarning,
}: EVACoolantProps) {
    const liquidStatus = liquidWarning ? "Critical" : "Normal";
    const liquidColor = liquidWarning ? "#F59095" : "#9DE4CE";

    const gasStatus = gasWarning ? "Unsafe" : "Safe";
    const gasColor = gasWarning ? "#F59095" : "#9DE4CE";

    const clamped = Math.min(100, Math.max(0, coolantStorage ?? 0));
    const isLow = clamped < 50;
    const fillColor = isLow ? "#A27077" : "#C3D2CE";

    const pct = clamped / 100;
    const indicator = gaugePoint(pct);

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* Gauge */}
            <div style={{ position: "relative", width: 137, height: 122, flexShrink: 0 }}>
                <svg viewBox="0 0 137 122" width="137" height="122" style={{ overflow: "visible" }}>
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

                <span
                    className={typo.h4}
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: CX,
                        transform: "translate(-50%, -50%)",
                        color: "#FFF",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                    }}
                >
                    {coolantStorage !== null ? `${clamped.toFixed(0)}%` : "--"}
                </span>
                <span
                    className={typo.p}
                    style={{
                        position: "absolute",
                        top: "calc(50% + 49px)",
                        left: CX,
                        transform: "translateX(-50%)",
                        color: "#C5C9D2",
                        whiteSpace: "nowrap",
                    }}
                >
                    Coolant Storage
                </span>
            </div>

            {/* Pressure metrics */}
            <div
                style={{
                    background: "#2e2e32",
                    borderRadius: 10,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span className={typo.p} style={{ color: liquidColor }}>
                            {liquidStatus}
                        </span>
                        <span className={typo.p} style={{ color: "#C5C9D2" }}>
                            Liquid Pressure
                        </span>
                    </div>
                    <span className={typo.p} style={{ color: "#A1A4AF" }}>
                        {liquidPressure !== null ? `${Math.round(liquidPressure)} psi` : "--"}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span className={typo.p} style={{ color: gasColor }}>
                            {gasStatus}
                        </span>
                        <span className={typo.p} style={{ color: "#C5C9D2" }}>
                            Gas Pressure
                        </span>
                    </div>
                    <span className={typo.p} style={{ color: "#A1A4AF" }}>
                        {gasPressure !== null ? `${Math.round(gasPressure)} psi` : "--"}
                    </span>
                </div>
            </div>
        </div>
    );
}
