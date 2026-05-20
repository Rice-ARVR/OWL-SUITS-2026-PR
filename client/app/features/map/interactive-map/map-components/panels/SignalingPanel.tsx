import styles from "../../InteractiveMap.module.css";

type SignalStatus = "pending" | "success" | "failed" | "not in range";

type ManualPingResult = {
    rssi_value: number;
    category: string;
    distance_min: number;
    distance_max: number;
} | null;

interface SignalingPanelProps {
    signalStatus: SignalStatus;
    lastManualPing?: ManualPingResult;
}

export function SignalingPanel({ signalStatus, lastManualPing }: SignalingPanelProps) {
    const errorColor =
        signalStatus === "failed" || signalStatus === "not in range" ? "#e74c3c" : "#6ee7b7";

    return (
        <div className={styles.panel} style={{ position: "relative" }}>
            <div className={styles.panelHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="2.5" fill={errorColor} />
                    <path
                        d="M8.5 15.5A5 5 0 0 1 8.5 8.5"
                        stroke={errorColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M15.5 8.5A5 5 0 0 1 15.5 15.5"
                        stroke={errorColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M5.5 18.5A10 10 0 0 1 5.5 5.5"
                        stroke={errorColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M18.5 5.5A10 10 0 0 1 18.5 18.5"
                        stroke={errorColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
                <span className={styles.panelTitle}>
                    {signalStatus === "pending"
                        ? "Signaling LTV"
                        : signalStatus === "success"
                          ? "Signal Success"
                          : signalStatus === "failed"
                            ? "Signal Failed"
                            : "Signal Not In Range"}
                </span>
            </div>
            {signalStatus === "success" && lastManualPing && (
                <div style={{ padding: "0 12px 8px" }}>
                    <span
                        className={styles.autoValue}
                        style={{ color: "#6ee7b7", fontSize: "12px" }}
                    >
                        RSSI: {Math.round(lastManualPing.rssi_value)} dBm ·{" "}
                        {lastManualPing.category}
                    </span>
                </div>
            )}
        </div>
    );
}
