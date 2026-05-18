import { useGamepadContext } from "~/contexts/GamepadContext";
import styles from "../../examples/TssExample.module.css";

export default function GamepadControls() {
    const { throttle, steering, brakes, cabinHeating, cabinCooling, headlights, connected } = useGamepadContext();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Gamepad Controller</h1>
            <p>
                Status: <strong>{connected ? "Connected" : "Disconnected"}</strong>
                {!connected && <span> — press any button on the controller to activate it</span>}
            </p>
            <table className={styles.table}>
                <tbody>
                    <tr>
                        <td>Throttle (left stick vertical)</td>
                        <td>{throttle}</td>
                    </tr>
                    <tr>
                        <td>Steering (right stick horizontal)</td>
                        <td>{steering.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Brakes (left / right trigger)</td>
                        <td>{brakes.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Cabin Heating (DPad up)</td>
                        <td>{cabinHeating === 1 ? "ON" : "OFF"}</td>
                    </tr>
                    <tr>
                        <td>Cabin Cooling (DPad down)</td>
                        <td>{cabinCooling === 1 ? "ON" : "OFF"}</td>
                    </tr>
                    <tr>
                        <td>Headlights (Y button)</td>
                        <td>{headlights === 1 ? "ON" : "OFF"}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
