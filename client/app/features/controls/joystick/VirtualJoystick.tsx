import { useMemo } from "react";
import { useWASD } from "~/hooks/useWASD";
import styles from "./VirtualJoystick.module.css";

const DIRECTION_THRESHOLD = 5;

interface Direction {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}

export default function VirtualJoystick() {
    const { throttle, steering } = useWASD();

    const knobY = useMemo(() => {
        return (throttle / 100) * 50;
    }, [throttle]);

    const knobX = useMemo(() => {
        return (steering * 50);
    }, [steering]);

    const directions: Direction = useMemo(() => ({
        up: throttle > DIRECTION_THRESHOLD,
        down: throttle < -DIRECTION_THRESHOLD,
        left: steering < -DIRECTION_THRESHOLD / 50,
        right: steering > DIRECTION_THRESHOLD / 50,
    }), [throttle, steering]);

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Virtual Joystick</h2>

            <div className={styles.joystickWrapper}>
                <div className={styles.joystick}>
                    <div className={styles.referenceCircle} />

                    <div
                        className={`${styles.directionIndicator} ${styles.up} ${directions.up ? styles.active : ""}`}
                    />
                    <div
                        className={`${styles.directionIndicator} ${styles.down} ${directions.down ? styles.active : ""}`}
                    />
                    <div
                        className={`${styles.directionIndicator} ${styles.left} ${directions.left ? styles.active : ""}`}
                    />
                    <div
                        className={`${styles.directionIndicator} ${styles.right} ${directions.right ? styles.active : ""}`}
                    />

                    <div
                        className={styles.knob}
                        style={{
                            transform: `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`,
                        }}
                    >
                        <div className={styles.knobInner} />
                    </div>
                </div>
            </div>

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

            <div className={styles.hints}>
                <div className={styles.hintRow}>
                    <kbd>W</kbd> / <kbd>S</kbd> — Throttle
                </div>
                <div className={styles.hintRow}>
                    <kbd>A</kbd> / <kbd>D</kbd> — Steering
                </div>
            </div>
        </div>
    );
}