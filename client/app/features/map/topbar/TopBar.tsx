import { useState, useEffect } from "react";
import styles from "./TopBar.module.css";
import { useTelemetry } from "~/hooks/useTelemetry";

interface TopBarProps {
    resourceStatus?: "safe" | "warning" | "critical";
    timeToPOI?: number; // seconds
    roverDirection?: number; // degrees 0-360
}

function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function degreesToCompass(deg: number | null): string {
    if (deg == null) {
        return "NW";
    }
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
}

export default function TopBar({
    resourceStatus = "safe",
    timeToPOI: timeToPOIProp = 0,
    roverDirection: roverDirectionProp = 307,
}: TopBarProps) {
    const [timeToPOI, setTimeToPOI] = useState(timeToPOIProp);
    const [roverDirection, setRoverDirection] = useState(roverDirectionProp);
    const [status, setStatus] = useState(resourceStatus);

    useEffect(() => setTimeToPOI(timeToPOIProp), [timeToPOIProp]);
    useEffect(() => setRoverDirection(roverDirectionProp), [roverDirectionProp]);
    useEffect(() => setStatus(resourceStatus), [resourceStatus]);

    const telemetry = useTelemetry();
    const missionTime = telemetry.getRoverElapsedTime() ?? 0;

    // Time to homebase = distance from base / current speed
    const distanceFromBase = telemetry.getRoverDistanceFromBase() ?? 0;
    const speed = telemetry.getRoverSpeed() ?? 0;
    const timeToHomebase = speed > 0 ? Math.round(distanceFromBase / speed) : 0;

    const statusLabel: Record<string, string> = {
        safe: "Safe to proceed",
        warning: "Use caution",
        critical: "Return to base",
    };

    return (
        <div className={styles.topBar}>
            <div className={styles.item}>
                <span className={styles.label}>Resource Estimate</span>
                <div className={`${styles.statusBadge} ${styles[status]}`}>
                    {statusLabel[status]}
                </div>
            </div>

            <div className={styles.item}>
                <span className={styles.label}>Time to POI</span>
                <span className={styles.value}>{formatTime(timeToPOI)}</span>
            </div>

            <div className={styles.item}>
                <span className={styles.label}>Mission Time Elapsed</span>
                <span className={styles.value}>{formatTime(missionTime)}</span>
            </div>

            <div className={styles.item}>
                <span className={styles.label}>Time to Homebase</span>
                <span className={styles.value}>{formatTime(timeToHomebase)}</span>
            </div>

            <div className={styles.item}>
                <span className={styles.label}>Rover Direction</span>
                <span className={styles.value}>
                    {telemetry.getRoverHeading()?.toFixed(2)}°{" "}
                    {degreesToCompass(telemetry.getRoverHeading())}
                </span>
            </div>
        </div>
    );
}
