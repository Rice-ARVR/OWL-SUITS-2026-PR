import { useWASD } from "~/hooks/useWASD";
import styles from "../../examples/TssExample.module.css";

export default function WASDControls() {
    const { throttle, steering, brakes, cabinHeating, cabinCooling, headlights } = useWASD();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>WASD Controls</h1>
            <table className={styles.table}>
                <tbody>
                    <tr>
                        <td>Throttle (W / S)</td>
                        <td>{throttle.toFixed(0)}</td>
                    </tr>
                    <tr>
                        <td>Steering (A / D)</td>
                        <td>{steering.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Brakes (Space)</td>
                        <td>{brakes === 1 ? "ON" : "OFF"}</td>
                    </tr>
                    <tr>
                        <td>Cabin Heating (R)</td>
                        <td>{cabinHeating === 1 ? "ON" : "OFF"}</td>
                    </tr>
                    <tr>
                        <td>Cabin Cooling (E)</td>
                        <td>{cabinCooling === 1 ? "ON" : "OFF"}</td>
                    </tr>
                    <tr>
                        <td>Headlights (Q)</td>
                        <td>{headlights === 1 ? "ON" : "OFF"}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
