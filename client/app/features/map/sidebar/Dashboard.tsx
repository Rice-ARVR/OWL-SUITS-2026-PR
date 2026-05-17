import styles from "./Dashboard.module.css";

import { useTelemetry } from "~/hooks/useTelemetry";

export default function Dashboard() {
    const telemetry = useTelemetry();
    const throttle = telemetry.getRoverThrottle() ?? 0;

    // throttle ranges from -100 to 100
    const fillWidth = Math.abs(throttle) / 2; // percentage of half the bar
    const fillStyle =
        throttle >= 0
            ? { left: "50%", width: `${fillWidth}%`, borderRadius: "0 1rem 1rem 0" }
            : {
                  left: `${50 - fillWidth}%`,
                  width: `${fillWidth}%`,
                  borderRadius: "1rem 0 0 1rem",
                  backgroundColor: "#e74c3c",
              };

    // Determine active gear
    const speed = telemetry.getRoverSpeed() ?? 0;
    const activeGear = throttle > 0 ? "D" : throttle < 0 ? "R" : speed > 0.01 ? "N" : "P";

    const gearStyle = (gear: string) => ({
        fontWeight: gear === activeGear ? 700 : 400,
        opacity: gear === activeGear ? 1 : 0.4,
    });

    return (
        <div className={styles.container}>
            <h1 className="xlarge">{speed.toFixed(2)}</h1>
            <div className={styles.dashboardInfo}>
                <div className={styles.gearSelector}>
                    <h5 className="medium" style={gearStyle("P")}>
                        P
                    </h5>
                    <h5 className="medium" style={gearStyle("R")}>
                        R
                    </h5>
                    <h5 className="medium" style={gearStyle("N")}>
                        N
                    </h5>
                    <h5 className="medium" style={gearStyle("D")}>
                        D
                    </h5>
                </div>
                <h5 className="medium">Kph</h5>
                <div className={styles.distanceContainer}>
                    <h5 className="medium">
                        {telemetry.getRoverDistanceTraveled()?.toFixed(0)} mi
                    </h5>
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
            <h5 className="medium">Throttle: {telemetry.getRoverThrottle()?.toFixed(2)}%</h5>
        </div>
    );
}
