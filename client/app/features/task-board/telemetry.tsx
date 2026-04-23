import { useEffect, useState } from "react";

import Battery from "~/components/ui/Battery";
import Card from "~/components/ui/Card";
import CO2 from "~/components/ui/CO2";
import Coolant from "~/components/ui/Coolant";
import EVACoolant from "~/components/ui/EVACoolant";
import Fans from "~/components/ui/Fans";
import Graph from "~/components/ui/Graphs";
import Health from "~/components/ui/Health";
import OtherPressure from "~/components/ui/OtherPressure";
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

  const roverWarnings: { message: string }[] = [];
  if (
    rover.cabin_temperature !== null &&
    (rover.cabin_temperature < 18 || rover.cabin_temperature > 27)
  )
    roverWarnings.push({ message: "Cabin Temperature is critical." });
  if (rover.oxygen_storage !== null && rover.oxygen_storage < 20)
    roverWarnings.push({ message: "Oxygen Storage is low." });
  if (rover.battery_level !== null && rover.battery_level < 50)
    roverWarnings.push({ message: "Battery is low." });
  if (
    rover.cabin_pressure !== null &&
    (rover.cabin_pressure < 4 || rover.cabin_pressure > 10)
  )
    roverWarnings.push({ message: "Cabin Pressure is unsafe." });
  if (
    rover.o2_pressure !== null &&
    (rover.o2_pressure < 700 || rover.o2_pressure > 3000)
  )
    roverWarnings.push({ message: "O2 Pressure is unsafe." });
  if (rover.coolant_storage !== null && rover.coolant_storage < 50)
    roverWarnings.push({ message: "Coolant Storage is low." });
  if (
    rover.coolant_pressure !== null &&
    (rover.coolant_pressure < 100 || rover.coolant_pressure > 3500)
  )
    roverWarnings.push({ message: "Coolant Pressure is unsafe." });
  if (
    rover.fan1_rpm !== null &&
    (rover.fan1_rpm < 500 || rover.fan1_rpm > 5000)
  )
    roverWarnings.push({ message: "Fan 1 is critical." });
  if (
    rover.fan2_rpm !== null &&
    (rover.fan2_rpm < 500 || rover.fan2_rpm > 5000)
  )
    roverWarnings.push({ message: "Fan 2 is critical." });

  const eva1 = eva.eva1;
  const evaWarnings: { message: string }[] = [];
  if (eva1.oxygen_storage !== null && eva1.oxygen_storage < 20)
    evaWarnings.push({ message: "Oxygen Storage is low." });
  if (eva1.eva_battery !== null && eva1.eva_battery < 50)
    evaWarnings.push({ message: "Battery is low." });
  if (
    eva1.total_suit_pressure !== null &&
    (eva1.total_suit_pressure < 4 || eva1.total_suit_pressure > 10)
  )
    evaWarnings.push({ message: "Suit Pressure is unsafe." });
  if (
    eva1.o2_suit_pressure !== null &&
    (eva1.o2_suit_pressure < 3.0 || eva1.o2_suit_pressure > 6.0)
  )
    evaWarnings.push({ message: "O2 Suit Pressure is unsafe." });
  if (eva1.co2_suit_pressure !== null && eva1.co2_suit_pressure > 1.0)
    evaWarnings.push({ message: "CO2 Suit Pressure is unsafe." });
  if (eva1.co2_scrubber !== null && eva1.co2_scrubber > 75)
    evaWarnings.push({ message: "CO2 Scrubber is critical." });
  if (
    eva1.other_pressure !== null &&
    (eva1.other_pressure < 0 || eva1.other_pressure > 5)
  )
    evaWarnings.push({ message: "Other Pressure is unsafe." });
  if (
    eva1.body_temperature !== null &&
    (eva1.body_temperature < 20 || eva1.body_temperature > 30)
  )
    evaWarnings.push({ message: "Body Temperature is critical." });
  if (
    eva1.heart_rate !== null &&
    (eva1.heart_rate < 60 || eva1.heart_rate > 120)
  )
    evaWarnings.push({ message: "Heart Rate is critical." });
  if (eva1.co2_production !== null && eva1.co2_production > 3500)
    evaWarnings.push({ message: "CO2 Production is critical." });
  if (eva1.helmet_co2_pressure !== null && eva1.helmet_co2_pressure > 5)
    evaWarnings.push({ message: "Helmet CO2 Pressure is critical." });
  if (eva1.fan1_rpm !== null && (eva1.fan1_rpm < 500 || eva1.fan1_rpm > 5000))
    evaWarnings.push({ message: "Fan 1 is critical." });
  if (eva1.fan2_rpm !== null && (eva1.fan2_rpm < 500 || eva1.fan2_rpm > 5000))
    evaWarnings.push({ message: "Fan 2 is critical." });
  if (eva1.coolant_storage !== null && eva1.coolant_storage < 50)
    evaWarnings.push({ message: "Coolant Storage is low." });
  if (
    eva1.liquid_pressure !== null &&
    (eva1.liquid_pressure < 200 || eva1.liquid_pressure > 1000)
  )
    evaWarnings.push({ message: "Liquid Pressure is critical." });
  if (eva1.gas_pressure !== null && eva1.gas_pressure > 700)
    evaWarnings.push({ message: "Gas Pressure is unsafe." });

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Row 1 */}
        <div style={{ display: "flex", gap: 16 }}>
          <Card style={{ width: 314, height: 384, flexShrink: 0 }} title="A">
            <div
              style={{
                zoom: 0.85,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Summary showReflection={false} warnings={roverWarnings} />
            </div>
          </Card>
          <Card style={{ width: 345, height: 384, flexShrink: 0 }} title="B">
            <div
              style={{
                zoom: 1.2,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Temperature
                temperature={rover.cabin_temperature}
                outsideTemperature={rover.outside_temperature}
              />
            </div>
          </Card>
          <Card style={{ width: 314, height: 384, flexShrink: 0 }} title="C">
            <div
              style={{
                zoom: 0.85,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Summary
                image="/astronaut.png"
                label="EVA 1"
                showReflection={false}
                warnings={evaWarnings}
              />
            </div>
          </Card>
          <Card
            style={{
              width: 823,
              height: 384,
              flexShrink: 0,
              overflow: "hidden",
            }}
            title="D"
          >
            <img
              src="/moon.png"
              alt="Moon"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          </Card>
        </div>

        {/* Rows 2–3 */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Col E + J */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card
              style={{
                width: 240,
                height: 275,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="E"
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Oxygen level={rover.oxygen_storage ?? 0} tankLabel="PR Tank" />
              </div>
            </Card>
            <Card
              style={{
                width: 240,
                height: 335,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="J"
            >
              <div
                style={{
                  zoom: 0.9,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Battery level={rover.battery_level ?? 0} label="PR Battery" />
              </div>
            </Card>
          </div>

          {/* Col F + K */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card
              style={{
                width: 419,
                height: 335,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="F"
            >
              <div
                style={{
                  zoom: 1.1,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
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
                  safeMin={700}
                  safeMax={3000}
                />
              </div>
            </Card>
            <Card
              style={{
                width: 419,
                height: 275,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="K"
            >
              <div
                style={{
                  zoom: 0.9,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
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
              </div>
            </Card>
          </div>

          {/* Col G + M */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card
              style={{
                width: 240,
                height: 275,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="G"
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Oxygen
                  level={eva.eva1.oxygen_storage ?? 0}
                  tankLabel="EVA 1 Tank"
                />
              </div>
            </Card>
            <Card
              style={{
                width: 240,
                height: 335,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="M"
            >
              <div
                style={{
                  zoom: 0.9,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Battery
                  level={eva.eva1.eva_battery ?? 0}
                  label="EVA 1 Battery"
                />
              </div>
            </Card>
          </div>

          {/* H — spans both rows */}
          <Card
            style={{
              width: 424,
              height: 626,
              flexShrink: 0,
              overflow: "hidden",
            }}
            title="H"
          >
            <div
              style={{
                zoom: 0.9,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
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
                safeMin={3.0}
                safeMax={6.0}
              />
              <Graph
                value={eva.eva1.co2_suit_pressure}
                label="CO₂ Pressure"
                unit=" psi"
                min={0}
                max={10}
                safeMin={0}
                safeMax={1.0}
              />
              <Graph
                value={eva.eva1.co2_scrubber}
                label="CO₂ Scrubber"
                unit="% full"
                min={0}
                max={100}
                safeMin={0}
                safeMax={75}
              />
              <OtherPressure value={eva.eva1.other_pressure} />
            </div>
          </Card>

          {/* Right col I + N + O */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card
              style={{
                width: 453,
                height: 124,
                flexShrink: 0,
                overflow: "hidden",
                padding: "0 16px",
                gap: 0,
              }}
              title="I"
            >
              <div
                style={{
                  zoom: 1.1,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Health
                  bodyTemp={eva.eva1.body_temperature}
                  heartRate={eva.eva1.heart_rate}
                />
              </div>
            </Card>
            <Card
              style={{
                width: 453,
                height: 289,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="N"
            >
              <div
                style={{
                  zoom: 1.1,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <CO2
                  co2Production={eva.eva1.co2_production}
                  helmetCo2Pressure={eva.eva1.helmet_co2_pressure}
                />
                <Fans
                  fans={[
                    { label: "Fan 1", rpm: eva.eva1.fan1_rpm ?? 0 },
                    { label: "Fan 2", rpm: eva.eva1.fan2_rpm ?? 0 },
                  ]}
                />
              </div>
            </Card>
            <Card
              style={{
                width: 453,
                height: 175,
                flexShrink: 0,
                overflow: "hidden",
              }}
              title="O"
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <EVACoolant
                  coolantStorage={eva.eva1.coolant_storage}
                  liquidPressure={eva.eva1.liquid_pressure}
                  gasPressure={eva.eva1.gas_pressure}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
