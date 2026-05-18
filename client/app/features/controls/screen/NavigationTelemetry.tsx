import { useNavigationTelemetry } from "~/hooks/useNavigationTelemetry";

import styles from "./NavigationTelemetry.module.css";

export default function NavigationTelemetry() {
    const nav = useNavigationTelemetry();

    const connectionStatus = nav.getConnectionStatus();
    const isConnected = connectionStatus === "connected";
    const isReady = nav.isReady();

    if (!isConnected && !isReady) {
        return (
            <div className={styles.container}>
                <h2 className={styles.title}>Autonomous Navigation</h2>
                <p className={styles.loading}>
                    {connectionStatus === "connecting"
                        ? "Connecting..."
                        : "Waiting for connection..."}
                </p>
            </div>
        );
    }

    const mode = nav.getMode();
    const threat = nav.getThreat();
    const steering = nav.getSteering();
    const throttle = nav.getThrottle();
    const health = nav.getHealth();

    return (
        <div className={`${styles.container} ${!isConnected ? styles.disconnected : ""}`}>
            <h2 className={styles.title}>🤖 Autonomous Navigation</h2>

            {mode && <div className={`${styles.message} ${styles.mode}`}>{mode}</div>}

            {threat && <div className={`${styles.message} ${styles.threat}`}>{threat}</div>}

            {steering && <div className={`${styles.message} ${styles.steering}`}>{steering}</div>}

            {throttle && <div className={`${styles.message} ${styles.throttle}`}>{throttle}</div>}

            {health && <div className={`${styles.message} ${styles.health}`}>{health}</div>}
        </div>
    );
}
