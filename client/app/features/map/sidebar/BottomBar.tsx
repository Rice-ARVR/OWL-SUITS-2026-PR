import { useState } from "react";
import styles from "./BottomBar.module.css";

interface BottomBarProps {
    manualMode?: boolean;
    onManualModeChange?: (value: boolean) => void;
}

export default function BottomBar({
    manualMode: manualModeProp = true,
    onManualModeChange,
}: BottomBarProps) {
    const [manualMode, setManualMode] = useState(manualModeProp);
    const [lightOn, setLightOn] = useState(false);
    const [signalOn, setSignalOn] = useState(false);

    const toggleManual = () => {
        const next = !manualMode;
        setManualMode(next);
        onManualModeChange?.(next);
    };

    return (
        <div className={styles.bottomBar}>
            <div className={styles.modeSection}>
                <span className={styles.modeText}>
                    Manual Mode <span className={styles.modeDivider}>|</span>{" "}
                    <span className={manualMode ? styles.modeOn : styles.modeOff}>
                        {manualMode ? "ON" : "OFF"}
                    </span>
                </span>
                <button
                    className={`${styles.toggle} ${manualMode ? styles.toggleOn : ""}`}
                    onClick={toggleManual}
                >
                    <div className={styles.toggleThumb} />
                </button>
            </div>

            <div className={styles.controls}>
                <button
                    className={`${styles.controlBtn} ${lightOn ? styles.controlBtnActive : ""}`}
                    onClick={() => setLightOn(!lightOn)}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        {/* Sun body */}
                        <circle cx="12" cy="12" r="4" fill="currentColor" />
                        {/* Rays */}
                        <line
                            x1="12"
                            y1="2"
                            x2="12"
                            y2="5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="12"
                            y1="19"
                            x2="12"
                            y2="22"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="2"
                            y1="12"
                            x2="5"
                            y2="12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="19"
                            y1="12"
                            x2="22"
                            y2="12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="4.9"
                            y1="4.9"
                            x2="6.7"
                            y2="6.7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="17.3"
                            y1="17.3"
                            x2="19.1"
                            y2="19.1"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="4.9"
                            y1="19.1"
                            x2="6.7"
                            y2="17.3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <line
                            x1="17.3"
                            y1="6.7"
                            x2="19.1"
                            y2="4.9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>

                <button
                    className={`${styles.controlBtn} ${signalOn ? styles.controlBtnActive : ""}`}
                    onClick={() => setSignalOn(!signalOn)}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        {/* Center dot */}
                        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                        {/* Inner arc */}
                        <path
                            d="M8.5 15.5A5 5 0 0 1 8.5 8.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M15.5 8.5A5 5 0 0 1 15.5 15.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        {/* Outer arc */}
                        <path
                            d="M5.5 18.5A10 10 0 0 1 5.5 5.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M18.5 5.5A10 10 0 0 1 18.5 18.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
