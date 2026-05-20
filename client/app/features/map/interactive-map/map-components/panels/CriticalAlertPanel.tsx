import styles from "../../InteractiveMap.module.css";

interface CriticalAlertPanelProps {
    message: string;
    onDismiss: () => void;
}

export function CriticalAlertPanel({ message, onDismiss }: CriticalAlertPanelProps) {
    return (
        <div
            className={styles.panel}
            style={{ position: "relative", borderLeft: "3px solid #e74c3c" }}
        >
            <div className={styles.panelHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <polygon
                        points="12,2 22,20 2,20"
                        stroke="#e74c3c"
                        strokeWidth="2"
                        fill="none"
                    />
                    <line
                        x1="12"
                        y1="9"
                        x2="12"
                        y2="14"
                        stroke="#e74c3c"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <circle cx="12" cy="17" r="1" fill="#e74c3c" />
                </svg>
                <span className={styles.panelTitle} style={{ color: "#e74c3c" }}>
                    Autonomous Navigation Stopped
                </span>
                <button
                    onClick={onDismiss}
                    style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#888",
                        padding: "0 2px",
                        lineHeight: 1,
                        fontSize: "16px",
                    }}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
            <div style={{ padding: "0 12px 10px" }}>
                <span
                    className={styles.autoValue}
                    style={{ color: "#ccc", fontSize: "12px" }}
                >
                    {message}
                </span>
                <p style={{ color: "#888", fontSize: "11px", margin: "6px 0 0" }}>
                    Control has been returned to the user.
                </p>
            </div>
        </div>
    );
}
