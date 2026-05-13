import { useTelemetry } from "~/hooks/useTelemetry";

import styles from "./TssExample.module.css";

export default function TssExample() {
    const telemetry = useTelemetry();

    if (!telemetry.isReady()) {
        return (
            <p className={styles.loading}>
                {telemetry.getConnectionStatus() === "connecting"
                    ? "Connecting..."
                    : "Waiting for telemetry..."}
            </p>
        );
    }

    const rows: { label: string; value: string }[] = [
        {
            label: "EVA Heart Rate",
            value: telemetry.getEva1HeartRate()?.toFixed(2) ?? "—",
        },
        {
            label: "EVA Temperature",
            value: telemetry.getEva1Temperature()?.toFixed(2) ?? "—",
        },
        {
            label: "LTV Signal Strength",
            value: String(telemetry.getLtvSignalStrength() ?? "—"),
        },
        {
            label: "LTV Last Known X",
            value: String(telemetry.getLtvLocation()?.x ?? "—"),
        },
        {
            label: "Rover Speed",
            value: String(telemetry.getRoverSpeed() ?? "—"),
        },
        {
            label: "Rover Battery Level",
            value: telemetry.getRoverBatteryLevel()?.toFixed(2) ?? "—",
        },
    ];

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>TSS Example</h1>
            <table className={styles.table}>
                <tbody>
                    {rows.map(({ label, value }) => (
                        <tr key={label}>
                            <td>{label}</td>
                            <td>{value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
