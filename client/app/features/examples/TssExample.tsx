import { useEffect, useState } from "react";

import styles from "./TssExample.module.css";

interface TssData {
  eva_heart_rate: number;
  eva_temperature: number;
  ltv_signal_strength: number;
  ltv_last_known_x: number;
  rover_speed: number;
  rover_battery_level: number;
}

const ROWS: { label: string; key: keyof TssData; decimals?: number }[] = [
  { label: "EVA Heart Rate", key: "eva_heart_rate", decimals: 2 },
  { label: "EVA Temperature", key: "eva_temperature", decimals: 2 },
  { label: "LTV Signal Strength", key: "ltv_signal_strength" },
  { label: "LTV Last Known X", key: "ltv_last_known_x" },
  { label: "Rover Speed", key: "rover_speed" },
  { label: "Rover Battery Level", key: "rover_battery_level", decimals: 2 },
];

export default function TssExample() {
  const [data, setData] = useState<TssData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    fetch(`${apiUrl}/tss_example`)
      .then((res) => res.json())
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!data) return <p className={styles.loading}>Loading...</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>TSS Example</h1>
      <table className={styles.table}>
        <tbody>
          {ROWS.map(({ label, key, decimals }) => (
            <tr key={key}>
              <td>{label}</td>
              <td>
                {decimals !== undefined
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
