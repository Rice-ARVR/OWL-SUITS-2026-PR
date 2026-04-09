import { useEffect, useRef, useState } from "react";
import { readGamepadState, type GamepadState } from "./gamepad_controller";
import styles from "../../examples/TssExample.module.css";

// Minimum time between API calls.
const SEND_INTERVAL_MS = 50;

// Set command thresholds.
const THROTTLE_THRESHOLD = 1; // out of 100
const STEERING_THRESHOLD = 0.01; // out of 1.0
const BRAKES_THRESHOLD = 0.01; // out of 1.0

// Safe default state used when the controller is disconnected.
const DISCONNECTED_STATE: GamepadState = {
  throttle: 0,
  steering: 0,
  brakes: 1.0,
  connected: false,
  hardwareError: null,
};

export default function GamepadControls() {
  const [connected, setConnected] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [steering, setSteering] = useState(0);
  const [brakes, setBrakes] = useState(1.0);

  // Refs track values that need to persist across animation frames without triggering re-renders.
  const prevSentRef = useRef<GamepadState>(DISCONNECTED_STATE); // last state sent to the API
  const lastSendTimeRef = useRef<number>(0); // rAF timestamp of last send
  const rafRef = useRef<number | null>(null); // handle for the rAF loop
  const prevHardwareErrorRef = useRef<string | null>(null); // last logged hardware error

  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  const sendControl = (state: GamepadState) => {
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
      const state = readGamepadState();
      const prev = prevSentRef.current;

      setConnected(state.connected);

      if (state.connected) {
        // Log when controller first connects.
        if (!prev.connected) {
          console.log("Controller connected");
        }

        // Log hardware faults on transition (new error, cleared error, or changed error).
        if (state.hardwareError !== prevHardwareErrorRef.current) {
          if (state.hardwareError !== null) {
            console.error("Controller hardware fault:", state.hardwareError);
          } else {
            console.log("Controller hardware fault cleared");
          }
          prevHardwareErrorRef.current = state.hardwareError;
        }

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
        console.log("Controller disconnected");

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
      <h1 className={styles.title}>Gamepad Controller</h1>
      <p>
        Status: <strong>{connected ? "Connected" : "Disconnected"}</strong>
        {!connected && (
          <span> — press any button on the controller to activate it</span>
        )}
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
            <td>Brakes (left trigger)</td>
            <td>{brakes.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
