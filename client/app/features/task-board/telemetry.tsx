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
import type { Warning } from "~/types/warning";
import styles from "./telemetry.module.css";

const FIELD_LABELS: Record<string, string> = {
    // Rover (PrTelemetry field names)
    cabin_temperature: "Cabin Temperature is critical.",
    oxygen_storage: "Oxygen Storage is low.",
    oxygen_pressure: "O2 Pressure is unsafe.",
    battery_level: "Battery is low.",
    cabin_pressure: "Cabin Pressure is unsafe.",
    coolant_storage: "Coolant Storage is low.",
    coolant_pressure: "Coolant Pressure is unsafe.",
    fan_pri_rpm: "Fan 1 is critical.",
    fan_sec_rpm: "Fan 2 is critical.",
    // EVA1 (Eva1Telemetry field names)
    primary_battery_level: "Battery is low.",
    oxy_pri_storage: "Oxygen Storage is low.",
    suit_pressure_total: "Suit Pressure is unsafe.",
    suit_pressure_oxy: "O2 Suit Pressure is unsafe.",
    suit_pressure_co2: "CO2 Suit Pressure is unsafe.",
    suit_pressure_other: "Other Pressure is unsafe.",
    helmet_pressure_co2: "Helmet CO2 Pressure is critical.",
    scrubber_a_co2_storage: "CO2 Scrubber is critical.",
    temperature: "Body Temperature is critical.",
    heart_rate: "Heart Rate is critical.",
    co2_production: "CO2 Production is critical.",
    coolant_liquid_pressure: "Liquid Pressure is critical.",
    coolant_gas_pressure: "Gas Pressure is unsafe.",
};

function warningMessage(w: Warning): string {
    return FIELD_LABELS[w.field] ?? `${w.field.replace(/_/g, " ")} is out of range.`;
}

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
    cabin_temperature_target: number | null;
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
    const [telemetryWarnings, setTelemetryWarnings] = useState<Warning[]>([]);

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

    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let active = true;

        const connect = () => {
            if (!active) return;
            const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
            const wsUrl = apiUrl.replace(/^http/, "ws");
            ws = new WebSocket(`${wsUrl}/ws/warnings`);
            ws.onmessage = (event: MessageEvent) => {
                try {
                    setTelemetryWarnings(JSON.parse(event.data as string) as Warning[]);
                } catch {
                    // ignore parse errors
                }
            };
            ws.onclose = () => {
                if (active) reconnectTimeout = setTimeout(connect, 1000);
            };
        };

        connect();
        return () => {
            active = false;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            ws?.close();
        };
    }, []);

    if (error) return <p className={styles.error}>{error}</p>;
    if (!rover || !eva) return <p className={styles.loading}>Loading...</p>;

    const roverWarnings = telemetryWarnings
        .filter((w) => w.source === "rover")
        .map((w) => ({ message: warningMessage(w) }));

    const evaWarnings = telemetryWarnings
        .filter((w) => w.source === "eva1")
        .map((w) => ({ message: warningMessage(w) }));

    const w = (source: "rover" | "eva1", field: string) =>
        telemetryWarnings.some((warn) => warn.source === source && warn.field === field && warn.out_of_range);

    return (
        <div className={styles.container}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Row 1 */}
                <div style={{ display: "flex", gap: 16 }}>
                    <Card style={{ width: 314, height: 384, flexShrink: 0, padding: 0 }} title="A">
                        <div
                            style={{
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
                                target={rover.cabin_temperature_target}
                            />
                        </div>
                    </Card>
                    <Card
                        style={{
                            width: 314,
                            height: 384,
                            flexShrink: 0,
                            padding: 0,
                            marginLeft: 16,
                        }}
                        title="C"
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
                                <Oxygen level={rover.oxygen_storage ?? 0} tankLabel="Tank 1" />
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
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 30,
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
                                    label="O2 Pressure"
                                    unit=" psi"
                                    min={0}
                                    max={3000}
                                    isWarning={w("rover", "oxygen_pressure")}
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
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 12,
                                }}
                            >
                                <Coolant
                                    storage={rover.coolant_storage}
                                    pressure={rover.coolant_pressure}
                                    storageWarning={w("rover", "coolant_storage")}
                                    pressureWarning={w("rover", "coolant_pressure")}
                                />
                                <Fans
                                    fans={[
                                        { label: "Fan 1", rpm: rover.fan1_rpm ?? 0 },
                                        { label: "Fan 2", rpm: rover.fan2_rpm ?? 0 },
                                    ]}
                                    fanWarnings={[
                                        w("rover", "fan_pri_rpm"),
                                        w("rover", "fan_sec_rpm"),
                                    ]}
                                />
                            </div>
                        </Card>
                    </div>

                    {/* Col G + M */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                            marginLeft: 16,
                        }}
                    >
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
                                <Oxygen level={eva.eva1.oxygen_storage ?? 0} tankLabel="Tank 1" />
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
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Battery level={eva.eva1.eva_battery ?? 0} label="EVA 1 Battery" />
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
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Pressure
                                value={eva.eva1.total_suit_pressure}
                                min={0}
                                max={10}
                                label="Total Suit Pressure"
                            />
                            <div style={{ height: "34px" }} />
                            <Graph
                                value={eva.eva1.o2_suit_pressure}
                                label="O2 Pressure"
                                unit=" psi"
                                min={0}
                                max={10}
                                borderBottom={false}
                                isWarning={w("eva1", "suit_pressure_oxy")}
                            />
                            <Graph
                                value={eva.eva1.co2_suit_pressure}
                                label="CO2 Pressure"
                                unit=" psi"
                                min={0}
                                max={10}
                                borderBottom={false}
                                borderTop={false}
                                isWarning={w("eva1", "suit_pressure_co2")}
                            />
                            <Graph
                                value={eva.eva1.co2_scrubber}
                                label="CO2 Scrubber"
                                unit="% full"
                                min={0}
                                max={100}
                                borderTop={false}
                                isWarning={w("eva1", "scrubber_a_co2_storage")}
                            />
                            <OtherPressure
                                value={eva.eva1.other_pressure}
                                isWarning={w("eva1", "suit_pressure_other")}
                            />
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
                                    bodyTempWarning={w("eva1", "temperature")}
                                    heartRateWarning={w("eva1", "heart_rate")}
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
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 10,
                                }}
                            >
                                <CO2
                                    co2Production={eva.eva1.co2_production}
                                    helmetCo2Pressure={eva.eva1.helmet_co2_pressure}
                                    co2ProductionWarning={w("eva1", "co2_production")}
                                    helmetCo2Warning={w("eva1", "helmet_pressure_co2")}
                                />
                                <Fans
                                    fans={[
                                        { label: "Fan 1", rpm: eva.eva1.fan1_rpm ?? 0 },
                                        { label: "Fan 2", rpm: eva.eva1.fan2_rpm ?? 0 },
                                    ]}
                                    fanWarnings={[
                                        w("eva1", "fan_pri_rpm"),
                                        w("eva1", "fan_sec_rpm"),
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
                                    liquidWarning={w("eva1", "coolant_liquid_pressure")}
                                    gasWarning={w("eva1", "coolant_gas_pressure")}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
