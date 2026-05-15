import { useMemo } from "react";
import { useWASD } from "~/hooks/useWASD";
import styles from "./VirtualJoystick.module.css";

const DIRECTION_THRESHOLD = 5;

export default function VirtualJoystick() {
    const { throttle, steering } = useWASD();

    // Determine which directions to highlight based on input magnitude
    const directions = useMemo(() => ({
        up: throttle > DIRECTION_THRESHOLD,
        down: throttle < -DIRECTION_THRESHOLD,
        left: steering < -DIRECTION_THRESHOLD / 50,
        right: steering > DIRECTION_THRESHOLD / 50,
    }), [throttle, steering]);

    // Calculate intensity (0-1) for glow effects
    const throttleIntensity = Math.min(Math.abs(throttle) / 100, 1);
    const steeringIntensity = Math.min(Math.abs(steering), 1);

    return (
        <div className={styles.container}>
            <div className={styles.joystickPad}>
                {/* Up Button */}
                <button
                    className={`${styles.directionButton} ${styles.up} ${directions.up ? styles.active : ""}`}
                    style={{
                        opacity: directions.up ? 1 : 0.5,
                        boxShadow: directions.up ? `0 0 20px rgba(255, 255, 255, 0.8)` : "none",
                    }}
                    aria-label="Up"
                />

                {/* Down Button */}
                <button
                    className={`${styles.directionButton} ${styles.down} ${directions.down ? styles.active : ""}`}
                    style={{
                        opacity: directions.down ? 1 : 0.5,
                        boxShadow: directions.down ? `0 0 20px rgba(255, 255, 255, 0.8)` : "none",
                    }}
                    aria-label="Down"
                />

                {/* Left Button */}
                <button
                    className={`${styles.directionButton} ${styles.left} ${directions.left ? styles.active : ""}`}
                    style={{
                        opacity: directions.left ? 1 : 0.5,
                        boxShadow: directions.left ? `0 0 20px rgba(255, 255, 255, 0.8)` : "none",
                    }}
                    aria-label="Left"
                />

                {/* Right Button */}
                <button
                    className={`${styles.directionButton} ${styles.right} ${directions.right ? styles.active : ""}`}
                    style={{
                        opacity: directions.right ? 1 : 0.5,
                        boxShadow: directions.right ? `0 0 20px rgba(255, 255, 255, 0.8)` : "none",
                    }}
                    aria-label="Right"
                />

                {/* Central Sphere */}
                <div
                    className={styles.sphere}
                    style={{
                        boxShadow: `0 0 ${20 + throttleIntensity * 20}px rgba(255, 255, 255, ${0.6 + throttleIntensity * 0.4})`,
                    }}
                />
            </div>

            {/* Digital Readout */}
            <div className={styles.readout}>
                <div className={styles.readoutRow}>
                    <span className={styles.label}>Throttle</span>
                    <span className={styles.value}>{throttle.toFixed(0).padStart(4)}</span>
                </div>
                <div className={styles.readoutRow}>
                    <span className={styles.label}>Steering</span>
                    <span className={styles.value}>{steering.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}