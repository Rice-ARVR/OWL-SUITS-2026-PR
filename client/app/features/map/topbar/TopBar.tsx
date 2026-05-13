import { useState, useEffect } from "react";
import styles from "./TopBar.module.css";
import { useTelemetry } from "~/hooks/useTelemetry";

interface TopBarProps {
    resourceStatus?: "safe" | "warning" | "critical";
    timeToPOI?: number; // seconds
    missionTime?: number; // seconds
    timeToHomebase?: number; // seconds
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
    missionTime: missionTimeProp = 0,
    timeToHomebase: timeToHomebaseProp = 0,
    roverDirection: roverDirectionProp = 307,
}: TopBarProps) {
    const [timeToPOI, setTimeToPOI] = useState(timeToPOIProp);
    const [missionTime, setMissionTime] = useState(missionTimeProp);
    const [timeToHomebase, setTimeToHomebase] = useState(timeToHomebaseProp);
    const [roverDirection, setRoverDirection] = useState(roverDirectionProp);
    const [status, setStatus] = useState(resourceStatus);

    useEffect(() => setTimeToPOI(timeToPOIProp), [timeToPOIProp]);
    useEffect(() => setMissionTime(missionTimeProp), [missionTimeProp]);
    useEffect(() => setTimeToHomebase(timeToHomebaseProp), [timeToHomebaseProp]);
    useEffect(() => setRoverDirection(roverDirectionProp), [roverDirectionProp]);
    useEffect(() => setStatus(resourceStatus), [resourceStatus]);

    const statusLabel: Record<string, string> = {
        safe: "Safe to proceed",
        warning: "Use caution",
        critical: "Return to base",
    };

    const telemetry = useTelemetry();

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
