import { useState } from "react";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
    const [speed, setSpeed] = useState(0.0);
    const [throttle, setThrottle] = useState(-30);
    const [distanceTravelled, setdistanceTravelled] = useState(60.0);

    // throttle ranges from -100 to 100
    const fillWidth = Math.abs(throttle) / 2; // percentage of half the bar
    const fillStyle =
        throttle >= 0
            ? { left: "50%", width: `${fillWidth}%`, borderRadius: "0 1rem 1rem 0" }
            : { left: `${50 - fillWidth}%`, width: `${fillWidth}%`, borderRadius: "1rem 0 0 1rem" };

    return (
        <div className={styles.container}>
            <h1 className="xlarge">{speed}</h1>
            <div className={styles.dashboardInfo}>
                <div className={styles.gearSelector}>
                    <h5 className="medium">P</h5>
                    <h5 className="medium">R</h5>
                    <h5 className="medium">N</h5>
                    <h5 className="medium">D</h5>
                </div>
                <h5 className="medium">Kph</h5>
                <div className={styles.distanceContainer}>
                    <h5 className="medium">{distanceTravelled} mi</h5>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${distanceTravelled}%` }}
                        />
                    </div>
                </div>
            </div>
            <div className={styles.sliderContainer}>
                <div className={styles.sliderFill} style={fillStyle} />
                <div className={styles.thumb} />
                <div className={styles.ticks}>
                    {Array.from({ length: 15 }, (_, i) => (
                        <div key={i} className={i === 7 ? styles.thumb : styles.tick} />
                    ))}
                </div>
            </div>
            <h5 className="medium">Throttle: {throttle}%</h5>
        </div>
    );
}
