import typo from "~/components/ui/typography.module.css";

interface EVACoolantProps {
    coolantStorage: number | null;
    liquidPressure: number | null;
    gasPressure: number | null;
    liquidWarning?: boolean;
    gasWarning?: boolean;
}

const CX = 61.13;
const CY = 62.76;
const R = 54.17;
const START_RAD = (150 * Math.PI) / 180;
const TOTAL_RAD = (242 * Math.PI) / 180;

const BG_PATH =
    "M107.074 91.4053C112.557 83.1719 115.714 73.6168 116.211 63.7456C116.709 53.8744 114.529 44.0519 109.901 35.3118C105.273 26.5716 98.3682 19.237 89.9131 14.0795C81.458 8.92212 71.7652 6.13264 61.8545 6.00461C51.9439 5.87659 42.1819 8.41475 33.5956 13.352C25.0094 18.2893 17.9164 25.4431 13.0631 34.0608C8.20972 42.6785 5.77541 52.4413 6.01629 62.3221C6.25718 72.2029 9.16435 81.8362 14.4319 90.2085";

// Reversed BG_PATH so the fill grows from the left end (0%) to the right end (100%)
const FILL_PATH =
    "M14.4319 90.2085C9.16435 81.8362 6.25718 72.2029 6.01629 62.3221C5.77541 52.4413 8.20972 42.6785 13.0631 34.0608C17.9164 25.4431 25.0094 18.2893 33.5956 13.352C42.1819 8.41475 51.9439 5.87659 61.8545 6.00461C71.7652 6.13264 81.458 8.92212 89.9131 14.0795C98.3682 19.237 105.273 26.5716 109.901 35.3118C114.529 44.0519 116.709 53.8744 116.211 63.7456C115.714 73.6168 112.557 83.1719 107.074 91.4053";

const SAFE_PATH =
    "M89.9131 14.0795C81.458 8.92212 71.7652 6.13264 61.8545 6.00461C51.9439 5.87659 42.1819 8.41475 33.5956 13.352C25.0094 18.2893 17.9164 25.4431 13.0631 34.0608C8.20971 42.6785 5.77541 52.4413 6.01629 62.3221C6.25718 72.2029 9.16435 81.8362 14.4319 90.2085";


const TICK_PATHS = [
    "M61.3438 8.59473L61.3437 3.40536",
    "M28.8047 18.5088L26.4453 15.9786",
    "M97.3594 21.9683L99.7188 19.4381",
    "M110.766 43.8101L115.61 41.9504",
    "M116.617 74.8325L113.309 73.821",
    "M11.9297 43.8101L7.085 41.9504",
    "M6.0625 74.8325L9.37091 73.821",
];

function gaugePoint(pct: number) {
    const angle = START_RAD + pct * TOTAL_RAD;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
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
