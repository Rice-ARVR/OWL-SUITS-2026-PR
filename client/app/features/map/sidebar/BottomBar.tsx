import { useState, useEffect } from "react";
import styles from "./BottomBar.module.css";
import { controllerManager } from "~/lib/controllerManager";
import { useTelemetry } from "~/hooks/useTelemetry";

interface BottomBarProps {
    manualMode?: boolean;
    onManualModeChange?: (value: boolean) => void;
    isAutonomous?: boolean;
    onStopAutonomy?: () => void;
    isSignaling?: boolean;
    onSignalLTV?: () => void;
    onHeadlightToggle?: (isOn: boolean) => void;
}

export default function BottomBar({
    manualMode: manualModeProp = true,
    onManualModeChange,
    isAutonomous = false,
    onStopAutonomy,
    isSignaling = false,
    onSignalLTV,
    onHeadlightToggle,
}: BottomBarProps) {
    const [manualMode, setManualMode] = useState(manualModeProp);
    const [lightOn, setLightOn] = useState(false);
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [lightInitialized, setLightInitialized] = useState(false);

    const telemetry = useTelemetry();

    // Sync initial headlight state from telemetry on first available data
    useEffect(() => {
        if (lightInitialized) return;
        const lightsOn = telemetry.getRoverLightsOn();
        if (lightsOn !== null) {
            setLightOn(lightsOn);
            setLightInitialized(true);
        }
    }, [telemetry, lightInitialized]);

    // When autonomous is active, manual mode is forced off
    const effectiveManualMode = isAutonomous ? false : manualMode;

    const toggleManual = () => {
        if (isAutonomous) {
            // User is trying to turn manual mode on while autonomous is running
            setShowStopConfirm(true);
            return;
        }
        // Only allow turning manual mode ON, not OFF
        if (effectiveManualMode) return;
        setManualMode(true);
        onManualModeChange?.(true);
    };

    const confirmStopAutonomy = () => {
        onStopAutonomy?.();
        setManualMode(true);
        onManualModeChange?.(true);
        setShowStopConfirm(false);
    };

    return (
        <div className={styles.bottomBar}>
            {showStopConfirm && (
                <div className={styles.confirmOverlay}>
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            Are you sure you want to stop autonomous navigation?
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.confirmCancelBtn}
                                onClick={() => setShowStopConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button className={styles.confirmStopBtn} onClick={confirmStopAutonomy}>
                                Stop Autonomy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.modeSection}>
                <span className={styles.modeText}>
                    Manual Mode <span className={styles.modeDivider}>|</span>{" "}
                    <span className={effectiveManualMode ? styles.modeOn : styles.modeOff}>
                        {effectiveManualMode ? "ON" : "OFF"}
                    </span>
                </span>
            </div>

            <div className={styles.controls}>
                <button
                    className={`${styles.controlBtn} ${lightOn ? styles.controlBtnActive : ""}`}
                    onClick={() => {
                        const next = !lightOn;
                        setLightOn(next);
                        controllerManager.sendCommand({
                            headlights: next ? 1.0 : 0.0,
                        });
                        onHeadlightToggle?.(next);
                    }}
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
                    className={`${styles.controlBtn} ${isSignaling ? styles.controlBtnActive : ""}`}
                    onClick={() => {
                        if (!isSignaling) onSignalLTV?.();
                    }}
                    style={{}}
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
