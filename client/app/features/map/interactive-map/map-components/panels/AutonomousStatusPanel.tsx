import styles from "../../InteractiveMap.module.css";
import type { NavState } from "../../useNavigationState";

interface AutonomousStatusPanelProps {
    session: NonNullable<NavState["session"]>;
    statusMessage?: string;
    statusLevel?: NavState["status_level"];
    onStop: () => void;
}

export function AutonomousStatusPanel({
    session,
    statusMessage,
    statusLevel,
    onStop,
}: AutonomousStatusPanelProps) {
    return (
        <div className={styles.panel} style={{ position: "relative" }}>
            <div className={styles.panelHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle
                        cx="11"
                        cy="11"
                        r="7"
                        stroke="#6ee7b7"
                        strokeWidth="2"
                        fill="none"
                    />
                    <line
                        x1="16.5"
                        y1="16.5"
                        x2="21"
                        y2="21"
                        stroke="#6ee7b7"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                </svg>
                <span className={styles.panelTitle}>Autonomous Navigation</span>
                <button className={styles.panelClose} onClick={onStop}>
                    ×
                </button>
            </div>

            <div className={styles.autoStatusBody}>
                <div className={styles.autoPhaseRow}>
                    <span className={styles.autoLabel}>Phase</span>
                    <span className={styles.autoPhaseBadge}>
                        {session.phase.replace(/_/g, " ")}
                    </span>
                </div>

                {session.current_target && (
                    <div className={styles.autoTargetBox}>
                        <span className={styles.autoLabel}>Current Target</span>
                        <span className={styles.autoTargetDesc}>
                            {session.current_target.description}
                        </span>
                    </div>
                )}

                {statusMessage && (
                    <div className={styles.autoPhaseRow}>
                        <span className={styles.autoLabel}>Status</span>
                        <span
                            className={styles.autoValue}
                            style={{
                                color:
                                    statusLevel === "critical"
                                        ? "#e74c3c"
                                        : statusLevel === "warning"
                                          ? "#fbbf24"
                                          : statusLevel === "success"
                                            ? "#6ee7b7"
                                            : "#ccc",
                            }}
                        >
                            {statusMessage}
                        </span>
                    </div>
                )}
            </div>

            <button className={styles.stopAutonomyBtn} onClick={onStop}>
                Stop Autonomous Navigation
            </button>
        </div>
    );
}
