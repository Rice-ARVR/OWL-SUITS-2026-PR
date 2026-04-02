import { useEffect, useRef, useState } from "react";
import styles from "../examples/TssExample.module.css";

interface TssData {
  eva_heart_rate: number;
  eva_temperature: number;
  ltv_signal_strength: number;
  ltv_last_known_x: number;
  rover_speed: number;
  rover_battery_level: number;
  throttle_control?: number;
  steering_control?: number;
}

const ROWS: { label: string; key: keyof TssData; decimals?: number }[] = [
  { label: "EVA Heart Rate", key: "eva_heart_rate", decimals: 2 },
  { label: "EVA Temperature", key: "eva_temperature", decimals: 2 },
  { label: "LTV Signal Strength", key: "ltv_signal_strength" },
  { label: "LTV Last Known X", key: "ltv_last_known_x" },
  { label: "Rover Speed", key: "rover_speed" },
  { label: "Rover Battery Level", key: "rover_battery_level", decimals: 2 },
  { label: "Throttle Control", key: "throttle_control", decimals: 0 },
  { label: "Steering Control", key: "steering_control", decimals: 1 },
];

export default function WASDControls() {
  const [data, setData] = useState<TssData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brakes, setBrakes] = useState<number>(1.0);

  // State for UI rendering
  const [throttle, setThrottle] = useState<number>(0.0);
  const [steering, setSteering] = useState<number>(0.0);

  // Refs to allow the interval to read the latest values without
  // adding them to the useEffect dependency array
  const throttleRef = useRef<number>(0.0);
  const steeringRef = useRef<number>(0.0);

  const pressedKeys = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  const sendControl = (newThrottle: number, newSteering: number) => {
    void fetch(`${apiUrl}/rover/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ throttle: newThrottle, steering: newSteering }),
    }).catch((err) => {
      console.error("Failed to send control command:", err);
    });
  };

  const updateControls = () => {
    // Read from refs instead of state
    let newThrottle = throttleRef.current;
    let newSteering = steeringRef.current;

    if (pressedKeys.current.has("w")) {
      newThrottle = Math.min(100.0, newThrottle + 10);
    }
    if (pressedKeys.current.has("s")) {
      newThrottle = Math.max(-100.0, newThrottle - 10);
    }
    if (pressedKeys.current.has("a")) {
      newSteering = Math.max(-1.0, newSteering - 0.1);
    }
    if (pressedKeys.current.has("d")) {
      newSteering = Math.min(1.0, newSteering + 0.1);
    }

    if (
      newThrottle !== throttleRef.current ||
      newSteering !== steeringRef.current
    ) {
      // Update refs
      throttleRef.current = newThrottle;
      steeringRef.current = newSteering;

      // Update UI state
      setThrottle(newThrottle);
      setSteering(newSteering);

      sendControl(newThrottle, newSteering);
    }
  };

  const startInterval = () => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(updateControls, 100);
    }
  };

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    const fetchTelemetry = () => {
      fetch(`${apiUrl}/tss_example`)
        .then((res) => res.json())
        .then(setData)
        .catch((err: Error) => setError(err.message));
    };

    fetchTelemetry();
    const telemetryInterval = setInterval(fetchTelemetry, 1000);

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "e"].includes(key)) {
        event.preventDefault();

        if (key === "e") {
          if (event.repeat) return;
          setBrakes((prevBrakes) => {
            const nextBrakes = prevBrakes === 1.0 ? 0.0 : 1.0;
            void fetch(`${apiUrl}/rover/control`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brakes: nextBrakes }),
            }).catch((err) => {
              console.error("Failed to send brakes command:", err);
            });
            return nextBrakes;
          });
        } else {
          // Ignore OS auto-repeat for WASD keys
          // (Our setInterval handles the holding logic)
          if (event.repeat) return;

          pressedKeys.current.add(key);

          // 1. Immediate change upon press
          updateControls();

          // 2. Start repeating every 400ms while held
          startInterval();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        pressedKeys.current.delete(key);
        if (pressedKeys.current.size === 0) {
          stopInterval();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(telemetryInterval);
      stopInterval();
    };
  }, []); // <-- Empty dependency array ensures listeners aren't destroyed on value updates

  if (error) return <p className={styles.error}>{error}</p>;
  if (!data) return <p className={styles.loading}>Loading...</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>WASD Controls</h1>
      <p>Press E to toggle brakes (currently: {brakes === 1 ? "ON" : "OFF"})</p>
      <p>
        WASD: Throttle {throttle.toFixed(0)}, Steering {steering.toFixed(1)}
      </p>
      <table className={styles.table}>
        <tbody>
          {ROWS.map(({ label, key, decimals }) => (
            <tr key={key}>
              <td>{label}</td>
              <td>
                {key === "throttle_control"
                  ? throttle.toFixed(decimals ?? 0)
                  : key === "steering_control"
                    ? steering.toFixed(decimals ?? 1)
                    : decimals !== undefined
                      ? (data[key] as number).toFixed(decimals)
                      : data[key]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
