import { ROVER_LIMITS } from "~/constants/telemetryLimits";
import typo from "~/components/ui/typography.module.css";
import { TrendArrow, useTrend } from "~/components/ui/trend";

interface TemperatureProps {
    temperature: number | null;
    outsideTemperature?: number | null;
    unit?: string;
    target?: number | null;
}

const {
    min: TEMP_MIN,
    max: TEMP_MAX,
    safeMin: TEMP_SAFE_MIN,
    safeMax: TEMP_SAFE_MAX,
} = ROVER_LIMITS.cabin_temperature;

function arcPoint(radius: number, pct: number) {
    const theta = Math.PI * (1 - pct);
    return { x: radius * Math.cos(theta), y: -radius * Math.sin(theta) };
}

function tempToPct(temp: number) {
    return Math.min(1, Math.max(0, (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)));
}

export default function Temperature({
    temperature,
    outsideTemperature,
    unit = "°",
    target,
}: TemperatureProps) {
    const value =
        Number.isFinite(temperature) && temperature !== null ? (temperature as number) : TEMP_MIN;
    const isSafe =
        temperature !== null &&
        Number.isFinite(temperature) &&
        (temperature as number) >= TEMP_SAFE_MIN &&
        (temperature as number) <= TEMP_SAFE_MAX;
    const radius = 94;
    const pct = tempToPct(value);
    const outsideTrend = useTrend(
        outsideTemperature !== undefined && outsideTemperature !== null ? outsideTemperature : null,
    );

    const indicator = arcPoint(radius, pct);

    return (
        <div
            style={{
                padding: 20,
                width: "100%",
                maxWidth: 240,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
            }}
        >
            {/* Semicircle gauge */}
            <div
                style={{
                    position: "relative",
                    width: 200,
                    height: 106,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <svg viewBox="0 0 200 106" width="200" height="106" style={{ overflow: "visible" }}>
                    <path
                        d="M194 100C194 87.6557 191.569 75.4324 186.845 64.0278C182.121 52.6231 175.197 42.2607 166.468 33.532C157.739 24.8033 147.377 17.8793 135.972 13.1553C124.568 8.43138 112.344 6 100 6C87.6557 6 75.4324 8.43138 64.0278 13.1553C52.6231 17.8793 42.2607 24.8033 33.532 33.532C24.8033 42.2607 17.8793 52.6232 13.1553 64.0278C8.43138 75.4324 6 87.6557 6 100"
                        fill="none"
                        stroke={isSafe ? "#74857F" : "#9C8080"}
                        strokeOpacity="0.35"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    <path
                        d="M147.398 20.1973L148.988 17.6531"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M53.0078 20.1973L51.4181 17.6531"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M22.0156 43.1621L25.0798 45.7333"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M10.1172 75L7.31645 73.9249"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M177.391 44.0991L174.326 46.6703"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M189.336 74.999L192.137 73.9239"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M100.5 8V4"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx={100 + indicator.x} cy={100 + indicator.y} r={6.5} fill="#F1F2F5" />
                </svg>

                {/* Center text */}
                <div
                    style={{
                        position: "absolute",
                        marginTop: 130,
                        left: 0,
                        right: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span className={typo.h2} style={{ color: "#F1F2F5", lineHeight: 1 }}>
                        {temperature !== null && Number.isFinite(temperature)
                            ? `${Math.round(temperature as number)}${unit}`
                            : "--"}
                    </span>
                    <span className={typo.p} style={{ color: "#C5C9D2" }}>
                        Cabin Temp.
                    </span>
                    <span className={typo.p} style={{ color: "#C5C9D2" }}>
                        Set to{" "}
                        {target !== null && Number.isFinite(target)
                            ? `${Math.round(target as number)}${unit}`
                            : "--"}
                    </span>
                    {!isSafe && (
                        <span className={typo.p} style={{ color: "#F59095" }}>
                            Risk of heat stress!
                        </span>
                    )}
                </div>
            </div>

            {/* Outside temperature box */}
            {outsideTemperature !== undefined && (
                <div
                    style={{
                        display: "flex",
                        padding: 20,
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 20,
                        borderRadius: 12,
                        background: "#2E2E32",
                        height: 96,
                        width: 305,
                        marginTop: 80,
                    }}
                >
                    <span className={typo.h5} style={{ color: "#C5C9D2" }}>
                        Outside temperature
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={typo.h4} style={{ color: "#E8EBF2" }}>
                            {outsideTemperature !== null && Number.isFinite(outsideTemperature)
                                ? `${Math.round(outsideTemperature as number)}${unit}`
                                : "--"}
                        </span>
                        <TrendArrow direction={outsideTrend} />
                    </div>
                </div>
            )}
        </div>
    );
}
