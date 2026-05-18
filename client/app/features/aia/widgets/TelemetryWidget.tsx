import type { TelemetryWidgetData } from "../../../types/aiaWidgets";
import { useTelemetry } from "~/hooks/useTelemetry";
import styles from "../aia.module.css";

type Props = {
    widget: TelemetryWidgetData;
};

function getSourceFromKey(key: string | undefined): string | null {
    if (!key) return null;
    if (key.includes("eva1")) return "EVA 1";
    if (key.includes("eva2")) return "EVA 2";
    if (key.includes("rover") || key.startsWith("pr_telemetry")) return "Rover";
    return null;
}

export default function TelemetryWidget({ widget }: Props) {
    const telemetry = useTelemetry();

    const trendSymbol =
        widget.trend === "up"
            ? "↑"
            : widget.trend === "down"
              ? "↓"
              : widget.trend === "stable"
                ? "→"
                : "";

    const source = getSourceFromKey(widget.telemetryKey);
    let liveValue = widget.value;

    switch (widget.telemetryKey) {
        case "telemetry_eva_eva1_heart_rate":
        case "telemetry_eva_telemetry_eva1_heart_rate":
            liveValue = telemetry.getEva1HeartRate() ?? widget.value;
            break;

        case "telemetry_eva_eva2_heart_rate":
        case "telemetry_eva_telemetry_eva2_heart_rate":
            liveValue = telemetry.getEva2HeartRate() ?? widget.value;
            break;

        case "pr_telemetry_cabin_temperature":
        case "telemetry_rover_pr_telemetry_cabin_temperature":
            liveValue = telemetry.getRoverCabinTemperature() ?? widget.value;
            break;

        case "pr_telemetry_speed":
        case "telemetry_rover_pr_telemetry_speed":
            liveValue = telemetry.getRoverSpeed() ?? widget.value;
            break;

        case "pr_telemetry_battery_level":
        case "telemetry_rover_pr_telemetry_battery_level":
            liveValue = telemetry.getRoverBatteryLevel() ?? widget.value;
            break;
        case "pr_telemetry_coolant_pressure":
        case "telemetry_rover_pr_telemetry_coolant_pressure":
            liveValue = telemetry.getRoverCoolantPressure() ?? widget.value;
            break;

        case "pr_telemetry_oxygen_pressure":
        case "telemetry_rover_pr_telemetry_oxygen_pressure":
            liveValue = telemetry.getRoverOxygenPressure() ?? widget.value;
            break;

        case "pr_telemetry_cabin_pressure":
        case "telemetry_rover_pr_telemetry_cabin_pressure":
            liveValue = telemetry.getRoverCabinPressure() ?? widget.value;
            break;

        case "pr_telemetry_external_temp":
        case "telemetry_rover_pr_telemetry_external_temp":
            liveValue = telemetry.getRoverExternalTemp() ?? widget.value;
            break;
    }

    return (
        <div className={styles.aiaWidget}>
            <div className={styles.aiaWidgetHeader}>
                <span className={styles.aiaWidgetTitle}>{widget.name}</span>

                {widget.status && (
                    <span
                        className={`${styles.aiaWidgetStatus} ${
                            widget.status === "normal"
                                ? styles.aiaWidgetStatusNormal
                                : widget.status === "warning"
                                  ? styles.aiaWidgetStatusWarning
                                  : widget.status === "critical"
                                    ? styles.aiaWidgetStatusCritical
                                    : styles.aiaWidgetStatusUnknown
                        }`}
                    >
                        {widget.status}
                    </span>
                )}
            </div>

            <div className={styles.aiaWidgetValue}>
                {typeof liveValue === "number" ? liveValue.toFixed(2) : liveValue}
                {widget.unit && <span className={styles.aiaWidgetUnit}> {widget.unit}</span>}
            </div>

            <div className={styles.aiaWidgetFooter}>
                {source && <span className={styles.aiaWidgetSource}>{source}</span>}
                {trendSymbol && <span>Trend: {trendSymbol}</span>}
                {widget.message && <span>{widget.message}</span>}
            </div>
        </div>
    );
}
