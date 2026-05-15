import { useState, useEffect } from "react";
import styles from "./TopBar.module.css";
import { useTelemetry } from "~/hooks/useTelemetry";

interface TopBarProps {
    resourceStatus?: "safe" | "warning" | "critical";
    roverDirection?: number; // degrees 0-360
    isAutonomous?: boolean;
    currentTargetPos?: { x: number; y: number } | null;
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
    roverDirection: roverDirectionProp = 307,
    isAutonomous = false,
    currentTargetPos = null,
}: TopBarProps) {
    const [roverDirection, setRoverDirection] = useState(roverDirectionProp);
    const [status, setStatus] = useState(resourceStatus);

    useEffect(() => setRoverDirection(roverDirectionProp), [roverDirectionProp]);
    useEffect(() => setStatus(resourceStatus), [resourceStatus]);

    const telemetry = useTelemetry();
    const missionTime = telemetry.getRoverElapsedTime() ?? 0;

    // Time to homebase = distance from base / average speed
    const distanceFromBase = telemetry.getRoverDistanceFromBase() ?? 0;
    const AVG_ROVER_SPEED = 2;
    const timeToHomebase = Math.round(distanceFromBase / AVG_ROVER_SPEED);

    // Time to POI = distance to current target / average speed (only during autonomous)
    let timeToPOI = 0;
    if (isAutonomous && currentTargetPos) {
        const pos = telemetry.getRoverPosition();
        if (pos) {
            const dx = currentTargetPos.x - pos.x;
            const dy = currentTargetPos.y - pos.y;
            const distToTarget = Math.sqrt(dx * dx + dy * dy);
            timeToPOI = Math.round(distToTarget / AVG_ROVER_SPEED);
        }
    }

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
