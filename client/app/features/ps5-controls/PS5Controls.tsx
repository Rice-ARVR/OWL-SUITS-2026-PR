import { useEffect, useRef, useState } from "react";
import { readPS5State, type PS5State } from "../../lib/ps5_controller";
import styles from "../examples/TssExample.module.css";

// Minimum time between API calls, in milliseconds (20 Hz).
const SEND_INTERVAL_MS = 50;

// Only send a new command when a value has changed by at least this much.
const THROTTLE_THRESHOLD = 1; // out of 100
const STEERING_THRESHOLD = 0.01; // out of 1.0
const BRAKES_THRESHOLD = 0.01; // out of 1.0

// Safe default state used when the controller is disconnected.
const DISCONNECTED_STATE: PS5State = {
  throttle: 0,
  steering: 0,
  brakes: 1.0,
  connected: false,
};

export default function PS5Controls() {
  const [connected, setConnected] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [brakes, setBrakes] = useState(1.0);

  // Refs track values that need to persist across animation frames without
  // triggering re-renders.
  const prevSentRef = useRef<PS5State>(DISCONNECTED_STATE); // last state sent to the API
  const lastSendTimeRef = useRef<number>(0);                // rAF timestamp of last send
  const rafRef = useRef<number | null>(null);               // handle for the rAF loop

  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  const sendControl = (state: PS5State) => {
    void fetch(`${apiUrl}/rover/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        throttle: state.throttle,
        steering: state.steering,
        brakes: state.brakes,
      }),
    }).catch((err: Error) => {
      console.error("Failed to send rover control command:", err);
    });
  };

  // Kick off a requestAnimationFrame loop that reads the gamepad state on every
  // frame and fires an API call when values change beyond the dead-zone thresholds.
  useEffect(() => {
    const poll = (timestamp: number) => {
      const state = readPS5State();
      const prev = prevSentRef.current;

      setConnected(state.connected);

      if (state.connected) {
        // Check whether any axis has moved past its dead-zone threshold.
        const throttleChanged =
          Math.abs(state.throttle - prev.throttle) >= THROTTLE_THRESHOLD;
        const steeringChanged =
          Math.abs(state.steering - prev.steering) >= STEERING_THRESHOLD;
        const brakesChanged =
          Math.abs(state.brakes - prev.brakes) >= BRAKES_THRESHOLD;
        const valuesChanged =
          throttleChanged || steeringChanged || brakesChanged;

        const rateLimitElapsed =
          timestamp - lastSendTimeRef.current >= SEND_INTERVAL_MS;

        // Send only when something changed AND the rate limit window has passed.
        if (valuesChanged && rateLimitElapsed) {
          prevSentRef.current = state;
          lastSendTimeRef.current = timestamp;

          setThrottle(state.throttle);
          setSteering(state.steering);
          setBrakes(state.brakes);

          sendControl(state);
        }
      } else if (prev.connected) {
        // Gamepad just disconnected — apply brakes as a safety measure.
        const safeState = { ...DISCONNECTED_STATE };
        prevSentRef.current = safeState;
        setThrottle(0);
        setSteering(0);
        setBrakes(1.0);
        sendControl(safeState);
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>PS5 Controller</h1>
      <p>
        Status: <strong>{connected ? "Connected" : "Disconnected"}</strong>
        {!connected && (
          <span> — press any button on the controller to activate it</span>
        )}
      </p>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td>Throttle (left stick Y)</td>
            <td>{throttle}</td>
          </tr>
          <tr>
            <td>Steering (left stick X)</td>
            <td>{steering.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Brakes (L2)</td>
            <td>{brakes.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
