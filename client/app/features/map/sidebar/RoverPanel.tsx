import styles from "./RoverPanel.module.css";
import RoverSvg from "../../../assets/rover.svg?react";

import { useTelemetry } from "~/hooks/useTelemetry";

// Generate a dynamic arc path + arrowhead based on angle value
function getArcData(degrees: number, side: "pitch" | "roll") {
    const absDeg = Math.min(Math.abs(degrees), 45);
    const isNeg = degrees < 0;
    const color = isNeg ? "#e74c3c" : "#6ee7b7";

    // Map 0–45° of actual rotation to 30–300° of arc sweep
    const sweepDeg = Math.max(30, (absDeg / 45) * 300);
    const sweepRad = (sweepDeg * Math.PI) / 180;

    const cx = 16,
        cy = 16,
        r = 11;
    const startAngle = -Math.PI / 2; // top of circle

    // Positive = counter-clockwise, negative = clockwise
    const clockwise = isNeg;

    const endAngle = clockwise ? startAngle + sweepRad : startAngle - sweepRad;

    const endX = cx + r * Math.cos(endAngle);
    const endY = cy + r * Math.sin(endAngle);

    const largeArc = sweepDeg > 180 ? 1 : 0;
    const sweepFlag = clockwise ? 1 : 0;

    const d = `M 16 5 A 11 11 0 ${largeArc} ${sweepFlag} ${endX.toFixed(1)} ${endY.toFixed(1)}`;

    // Arrowhead tangent to circle at end point
    const tangentAngle = endAngle + (clockwise ? Math.PI / 2 : -Math.PI / 2);
    const tipX = endX + 5 * Math.cos(tangentAngle);
    const tipY = endY + 5 * Math.sin(tangentAngle);
    const perpAngle = tangentAngle + Math.PI / 2;
    const b1X = endX + 3 * Math.cos(perpAngle);
    const b1Y = endY + 3 * Math.sin(perpAngle);
    const b2X = endX - 3 * Math.cos(perpAngle);
    const b2Y = endY - 3 * Math.sin(perpAngle);

    const arrow = `${tipX.toFixed(1)},${tipY.toFixed(1)} ${b1X.toFixed(1)},${b1Y.toFixed(1)} ${b2X.toFixed(1)},${b2Y.toFixed(1)}`;

    return { d, arrow, color };
}

export default function RoverPanel() {
    const telemetry = useTelemetry();
    const pitch = telemetry.getRoverPitch() ?? 0;
    const roll = telemetry.getRoverRoll() ?? 0;
    const pitchArc = getArcData(pitch, "pitch");
    const rollArc = getArcData(roll, "roll");

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
                        <circle
                            cx="16"
                            cy="16"
                            r="11"
                            fill="none"
                            stroke={pitchArc.color}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            opacity="0.25"
                        />
                        <path
                            d={pitchArc.d}
                            fill="none"
                            stroke={pitchArc.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <polygon points={pitchArc.arrow} fill={pitchArc.color} />
                    </svg>
                    <div className={styles.indicatorBox}>
                        <span
                            className={styles.indicatorValue}
                            style={{ color: pitch < 0 ? "#e74c3c" : undefined }}
                        >
                            {pitch.toFixed(2)}°
                        </span>
                    </div>
                </div>

                {/* Roll indicator (right) */}
                <div className={`${styles.indicator} ${styles.rollIndicator}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                        <circle
                            cx="16"
                            cy="16"
                            r="11"
                            fill="none"
                            stroke={rollArc.color}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            opacity="0.25"
                        />
                        <path
                            d={rollArc.d}
                            fill="none"
                            stroke={rollArc.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <polygon points={rollArc.arrow} fill={rollArc.color} />
                    </svg>
                    <div className={styles.indicatorBox}>
                        <span
                            className={styles.indicatorValue}
                            style={{ color: roll < 0 ? "#e74c3c" : undefined }}
                        >
                            {roll.toFixed(2)}°
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
