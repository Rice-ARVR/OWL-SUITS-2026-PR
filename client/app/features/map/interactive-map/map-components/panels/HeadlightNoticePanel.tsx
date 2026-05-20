import styles from "../../InteractiveMap.module.css";

interface HeadlightNoticePanelProps {
    state: "on" | "off";
}

export function HeadlightNoticePanel({ state }: HeadlightNoticePanelProps) {
    return (
        <div className={styles.panel} style={{ position: "relative" }}>
            <div className={styles.panelHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" fill={state === "on" ? "#6ee7b7" : "#888"} />
                    {state === "on" && (
                        <>
                            <line
                                x1="12"
                                y1="2"
                                x2="12"
                                y2="5"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            <line
                                x1="12"
                                y1="19"
                                x2="12"
                                y2="22"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            <line
                                x1="2"
                                y1="12"
                                x2="5"
                                y2="12"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            <line
                                x1="19"
                                y1="12"
                                x2="22"
                                y2="12"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </>
                    )}
                </svg>
                <span className={styles.panelTitle}>
                    {state === "on" ? "Headlights On" : "Headlights Off"}
                </span>
            </div>
        </div>
    );
}
