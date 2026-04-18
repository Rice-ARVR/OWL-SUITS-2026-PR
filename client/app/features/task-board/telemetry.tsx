import { useEffect, useState } from "react";

import Battery from "~/components/ui/Battery";
import Card from "~/components/ui/Card";
import Coolant from "~/components/ui/Coolant";
import Fans from "~/components/ui/Fans";
import Graph from "~/components/ui/Graphs";
import Oxygen from "~/components/ui/Oxygen";
import Pressure from "~/components/ui/Pressure";
import Summary from "~/components/ui/Summary";
import Temperature from "~/components/ui/Temperature";
import styles from "./telemetry.module.css";

interface RoverData {
  cabin_temperature: number | null;
  outside_temperature: number | null;
  oxygen_storage: number | null;
  battery_level: number | null;
  cabin_pressure: number | null;
  o2_pressure: number | null;
  coolant_storage: number | null;
  coolant_pressure: number | null;
  fan1_rpm: number | null;
  fan2_rpm: number | null;
}

interface Eva1Data {
  oxygen_storage: number | null;
  eva_battery: number | null;
  total_suit_pressure: number | null;
  o2_suit_pressure: number | null;
  co2_suit_pressure: number | null;
  co2_scrubber: number | null;
  other_pressure: number | null;
  body_temperature: number | null;
  heart_rate: number | null;
  co2_production: number | null;
  helmet_co2_pressure: number | null;
  fan1_rpm: number | null;
  fan2_rpm: number | null;
  coolant_storage: number | null;
  liquid_pressure: number | null;
  gas_pressure: number | null;
}

interface EvaData {
  eva1: Eva1Data;
}

const ROVER_ROWS: { label: string; key: keyof RoverData; decimals?: number }[] =
  [
    { label: "Cabin Temperature", key: "cabin_temperature", decimals: 2 },
    { label: "Outside Temperature", key: "outside_temperature", decimals: 2 },
    { label: "Oxygen Storage", key: "oxygen_storage", decimals: 2 },
    { label: "Battery Level", key: "battery_level", decimals: 2 },
    { label: "Cabin Pressure", key: "cabin_pressure", decimals: 2 },
    { label: "O2 Pressure", key: "o2_pressure", decimals: 2 },
    { label: "Coolant Storage", key: "coolant_storage", decimals: 2 },
    { label: "Coolant Pressure", key: "coolant_pressure", decimals: 2 },
    { label: "Fan 1 RPM", key: "fan1_rpm" },
    { label: "Fan 2 RPM", key: "fan2_rpm" },
  ];

const EVA1_ROWS: { label: string; key: keyof Eva1Data; decimals?: number }[] = [
  { label: "Oxygen Storage", key: "oxygen_storage", decimals: 2 },
  { label: "Battery", key: "eva_battery", decimals: 2 },
  { label: "Total Suit Pressure", key: "total_suit_pressure", decimals: 2 },
  { label: "O2 Suit Pressure", key: "o2_suit_pressure", decimals: 2 },
  { label: "CO2 Suit Pressure", key: "co2_suit_pressure", decimals: 2 },
  { label: "CO2 Scrubber", key: "co2_scrubber", decimals: 2 },
  { label: "Other Pressure", key: "other_pressure", decimals: 2 },
  { label: "Body Temperature", key: "body_temperature", decimals: 2 },
  { label: "Heart Rate", key: "heart_rate", decimals: 2 },
  { label: "CO2 Production", key: "co2_production", decimals: 2 },
  { label: "Helmet CO2 Pressure", key: "helmet_co2_pressure", decimals: 2 },
  { label: "Fan 1 RPM", key: "fan1_rpm" },
  { label: "Fan 2 RPM", key: "fan2_rpm" },
  { label: "Coolant Storage", key: "coolant_storage", decimals: 2 },
  { label: "Liquid Pressure", key: "liquid_pressure", decimals: 2 },
  { label: "Gas Pressure", key: "gas_pressure", decimals: 2 },
];

function DataTable<T extends Record<string, number | null>>({
  data,
  rows,
}: {
  data: T;
  rows: { label: string; key: keyof T; decimals?: number }[];
}) {
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map(({ label, key, decimals }) => {
          const value = data[key];
          return (
            <tr key={String(key)}>
              <td>{label}</td>
              <td>
                {value === null || value === undefined
                  ? "—"
                  : decimals !== undefined
                    ? (value as number).toFixed(decimals)
                    : value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Telemetry() {
  const [rover, setRover] = useState<RoverData | null>(null);
  const [eva, setEva] = useState<EvaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

    const fetchData = () => {
      Promise.all([
        fetch(`${apiUrl}/vital_signs/rover`).then((res) => res.json()),
        fetch(`${apiUrl}/vital_signs/eva`).then((res) => res.json()),
      ])
        .then(([roverData, evaData]) => {
          setRover(roverData);
          setEva(evaData);
        })
        .catch((err: Error) => setError(err.message));
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!rover || !eva) return <p className={styles.loading}>Loading...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h1 className={styles.title}>Rover</h1>
        <div className={styles.grid}>
          <Card title="Status Rover">
            <Summary showReflection={false} />
          </Card>
          <Card title="Battery">
            <Battery level={rover.battery_level ?? 0} label="PR Battery" />
          </Card>
          <Card title="Oxygen Storage">
            <Oxygen level={rover.oxygen_storage ?? 0} tankLabel="PR Tank" />
          </Card>
          <Card title="Temperature">
            <Temperature
              temperature={rover.cabin_temperature}
              outsideTemperature={rover.outside_temperature}
            />
          </Card>
          <Card style={{ maxWidth: 600 }} title="Rover pressure">
            <Pressure
              value={rover.cabin_pressure}
              min={0}
              max={10}
              label="Cabin Pressure"
            />
            <Graph
              value={rover.o2_pressure}
              label="O₂ Pressure"
              unit=" psi"
              min={0}
              max={3000}
            />
          </Card>
          <Card title="Fans">
            <Coolant
              storage={rover.coolant_storage}
              pressure={rover.coolant_pressure}
            />
            <Fans
              fans={[
                { label: "Fan 1", rpm: rover.fan1_rpm ?? 0 },
                { label: "Fan 2", rpm: rover.fan2_rpm ?? 0 },
              ]}
            />
          </Card>
        </div>

        <h1 className={styles.title}>EVA 1</h1>
        <div className={styles.grid}>
          <Card title="Status EVA">
            <Summary
              image="/astronaut.png"
              label="EVA 1"
              showReflection={false}
            />
          </Card>
          <Card title="Battery">
            <Battery level={eva.eva1.eva_battery ?? 0} label="EVA 1 Battery" />
          </Card>
          <Card title="Oxygen Storage">
            <Oxygen
              level={eva.eva1.oxygen_storage ?? 0}
              tankLabel="EVA 1 Tank"
            />
          </Card>
          <Card title="Fans">
            <Fans
              fans={[
                { label: "Fan 1", rpm: eva.eva1.fan1_rpm ?? 0 },
                { label: "Fan 2", rpm: eva.eva1.fan2_rpm ?? 0 },
              ]}
            />
          </Card>
          <Card title="EVA Pressure">
            <Pressure
              value={eva.eva1.total_suit_pressure}
              min={0}
              max={10}
              label="Total Suit Pressure"
            />
            <Graph
              value={eva.eva1.o2_suit_pressure}
              label="O₂ Pressure"
              unit=" psi"
              min={0}
              max={10}
            />
            <Graph
              value={eva.eva1.co2_suit_pressure}
              label="CO₂ Pressure"
              unit=" psi"
              min={0}
              max={10}
            />
            <Graph
              value={eva.eva1.co2_scrubber}
              label="CO₂ Scrubber"
              unit="% full"
              min={0}
              max={100}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
