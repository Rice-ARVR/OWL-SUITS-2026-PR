import styles from "./RoverPanel.module.css";
import RoverSvg from "../../../assets/rover.svg?react";

import { useTelemetry } from "~/hooks/useTelemetry";

export default function RoverPanel() {
    const telemetry = useTelemetry();
    return (
        <div className={styles.container}>
            <div className={styles.roverContainer}>
                <RoverSvg width={200} height={200} />
                <svg className={styles.arrowOverlay} viewBox="-20 0 220 200">
                    {/* Arrow 1 */}
                    <line x1="55" y1="50" x2="15" y2="32" stroke="#7B7B84" strokeWidth="3" />
                    <polygon points="10,30 22,29 17,40" fill="#7B7B84" />

                    {/* Arrow 2 */}
                    <line x1="120" y1="80" x2="180" y2="106" stroke="#7B7B84" strokeWidth="3" />
                    <polygon points="190,110 177,111 181,100" fill="#7B7B84" />

                    {/* Arrow 3 */}
                    <line x1="40" y1="110" x2="-5" y2="146" stroke="#7B7B84" strokeWidth="3" />
                    <polygon points="-10,150 -6,139 2,148" fill="#7B7B84" />

                    {/* Arrow 4 */}
                    <line x1="150" y1="40" x2="166" y2="26" stroke="#7B7B84" strokeWidth="3" />
                    <polygon points="170,23 166,34 158,25" fill="#7B7B84" />
                </svg>

                {/* Pitch indicator (left) */}
                <div className={`${styles.indicator} ${styles.pitchIndicator}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                        <path
                            d="M 16 5 A 11 11 0 1 1 7 21"
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <polygon points="4,19 10,19 7,25" fill="#6ee7b7" />
                    </svg>
                    <div className={styles.indicatorBox}>
                        <span className={styles.indicatorValue}>
                            {telemetry.getRoverPitch()?.toFixed(2)}°
                        </span>
                    </div>
                </div>

                {/* Roll indicator (right) */}
                <div className={`${styles.indicator} ${styles.rollIndicator}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                        <path
                            d="M 16 5 A 11 11 0 1 0 25 21"
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <polygon points="22,19 28,19 25,25" fill="#6ee7b7" />
                    </svg>
                    <div className={styles.indicatorBox}>
                        <span className={styles.indicatorValue}>
                            {telemetry.getRoverRoll()?.toFixed(2)}°
                        </span>
                    </div>
                </div>
            </div>

            <h5 className="medium">
                Surface Incline: {telemetry.getRoverSurfaceIncline()?.toFixed(2)}°
            </h5>
        </div>
    );
}
