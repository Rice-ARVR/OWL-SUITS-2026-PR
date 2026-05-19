import Graph from "~/components/ui/Graphs";
import Temperature from "~/components/ui/Temperature";
import typo from "~/components/ui/typography.module.css";
import { ROVER_LIMITS } from "~/constants/telemetryLimits";
import { useTelemetry } from "~/hooks/useTelemetry";
import { controllerManager } from "~/lib/controllerManager";

const COOLING_COLOR = "#9DE4CE";
const HEATING_COLOR = "#F59095";

function ToggleSwitch({
    label,
    active,
    onToggle,
    activeColor,
}: {
    label: string;
    active: boolean;
    onToggle: () => void;
    activeColor: string;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className={typo.p} style={{ color: "#C5C9D2" }}>
                {label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                    onClick={onToggle}
                    style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        background: active ? activeColor : "#4A4A52",
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        flexShrink: 0,
                        transition: "background 0.2s",
                    }}
                >
                    <span
                        style={{
                            position: "absolute",
                            top: 3,
                            left: active ? 25 : 3,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#F1F2F5",
                            transition: "left 0.2s",
                            display: "block",
                        }}
                    />
                </button>
                <span className={typo.p} style={{ color: active ? activeColor : "#8B95A6" }}>
                    {active ? "ON" : "OFF"}
                </span>
            </div>
        </div>
    );
}

export default function CabinClimate() {
    const telemetry = useTelemetry();

    const cabinTemp = telemetry.getRoverCabinTemperature();
    const cabinTempTarget =
        telemetry.getRoverSnapshot()?.pr_telemetry.cabin_temperature_target ?? null;
    const isCooling = telemetry.getRoverCabinCooling() ?? false;
    const isHeating = telemetry.getRoverCabinHeating() ?? false;

    const isWarning =
        cabinTemp !== null &&
        (cabinTemp < ROVER_LIMITS.cabin_temperature.safeMin ||
            cabinTemp > ROVER_LIMITS.cabin_temperature.safeMax);

    const toggleCooling = () => {
        controllerManager.sendCommand({ cabin_cooling: isCooling ? 0.0 : 1.0 });
    };

    const toggleHeating = () => {
        controllerManager.sendCommand({ cabin_heating: isHeating ? 0.0 : 1.0 });
    };

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                gap: 12,
                overflow: "hidden",
                padding: "4px 8px",
                boxSizing: "border-box",
            }}
        >
            {/* Temperature dial — scaled down and nudged up */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "visible",
                    marginLeft: -8,
                }}
            >
                <div
                    style={{
                        transform: "scale(0.8)",
                        transformOrigin: "center center",
                        marginTop: -24,
                    }}
                >
                    <Temperature temperature={cabinTemp} target={cabinTempTarget} />
                </div>
            </div>

            {/* Temperature trend graph */}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    marginLeft: -6,
                }}
            >
                <Graph
                    value={cabinTemp}
                    label="Cabin Temp."
                    unit="°"
                    min={ROVER_LIMITS.cabin_temperature.min}
                    max={ROVER_LIMITS.cabin_temperature.max}
                    isWarning={isWarning}
                />
            </div>

            {/* Cabin climate switches */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 15,
                    padding: "40px 28px",
                    background: "#2E2E32",
                    borderRadius: 12,
                    flexShrink: 0,
                    height: 140,
                    alignSelf: "center",
                }}
            >
                <ToggleSwitch
                    label="Cabin Cooling"
                    active={isCooling}
                    onToggle={toggleCooling}
                    activeColor={COOLING_COLOR}
                />
                <ToggleSwitch
                    label="Cabin Heating"
                    active={isHeating}
                    onToggle={toggleHeating}
                    activeColor={HEATING_COLOR}
                />
            </div>
        </div>
    );
}
