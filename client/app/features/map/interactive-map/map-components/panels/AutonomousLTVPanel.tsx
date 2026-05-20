import styles from "../../InteractiveMap.module.css";

interface AutonomousLTVPanelProps {
    onLaunch: () => void;
    onCancel: () => void;
}

export function AutonomousLTVPanel({ onLaunch, onCancel }: AutonomousLTVPanelProps) {
    return (
        <div className={styles.panel}>
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
                    <path
                        d="M11 8a3 3 0 0 1 3 3"
                        stroke="#6ee7b7"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
                <span className={styles.panelTitle}>Autonomous LTV Search</span>
                <button className={styles.panelClose} onClick={onCancel}>
                    ×
                </button>
            </div>

            <div className={styles.poiForm}>
                <button className={styles.finishBtn} onClick={onLaunch}>
                    Start Autonomous Navigation
                </button>
            </div>
        </div>
    );
}
