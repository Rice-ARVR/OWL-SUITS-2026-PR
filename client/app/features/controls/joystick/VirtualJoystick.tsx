import { useMemo } from "react";
import { useWASD } from "~/hooks/useWASD";
import styles from "./VirtualJoystick.module.css";

const DIRECTION_THRESHOLD = 5;

export default function VirtualJoystick() {
    const { throttle, steering } = useWASD();

    const up = throttle > DIRECTION_THRESHOLD;
    const down = throttle < -DIRECTION_THRESHOLD;
    const left = steering < -DIRECTION_THRESHOLD / 50;
    const right = steering > DIRECTION_THRESHOLD / 50;

    const dx = right ? 14 : left ? -14 : 0;
    const dy = down ? 14 : up ? -14 : 0;

    return (
        <div className={styles.container}>
            <div className={styles.joystickPad}>
                <div className={styles.dpad}>
                    <button
                        className={`${styles.btn} ${styles.up}    ${up ? styles.active : ""}`}
                        aria-label="Up"
                    />
                    <button
                        className={`${styles.btn} ${styles.down}  ${down ? styles.active : ""}`}
                        aria-label="Down"
                    />
                    <button
                        className={`${styles.btn} ${styles.left}  ${left ? styles.active : ""}`}
                        aria-label="Left"
                    />
                    <button
                        className={`${styles.btn} ${styles.right} ${right ? styles.active : ""}`}
                        aria-label="Right"
                    />
                    <div
                        className={styles.sphereWrap}
                        style={{ transform: `translate(${dx}px, ${dy}px)` }}
                    >
                        <div className={styles.sphere} />
                    </div>
                </div>
            </div>
        </div>
    );
}
