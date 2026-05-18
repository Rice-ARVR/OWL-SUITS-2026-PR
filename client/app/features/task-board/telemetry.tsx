import { useEffect, useState } from "react";
import { useTelemetry } from "~/hooks/useTelemetry";
import { useEstimates } from "./hooks/useEstimates";

import { EVA_LIMITS, ROVER_LIMITS } from "~/constants/telemetryLimits";
import { getTelemetryLabel } from "~/constants/telemetryLabels";

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

function formatRemaining(s: number | null): string {
    if (s == null || s <= 0) return "00:00:00 Remaining";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} Remaining`;
}

export default function Telemetry() {
    const telemetry = useTelemetry();
    const estimates = useEstimates();
    const [telemetryWarnings, setTelemetryWarnings] = useState<Warning[]>([]);

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

    const snapshot = telemetry.getSnapshot();

    if (!snapshot) return <p className={styles.loading}>Loading...</p>;

    const eva1 = snapshot.eva.telemetry.eva1;
    const rover = snapshot.rover.pr_telemetry;

    const roverWarnings = telemetryWarnings.filter((w) => w.source === "rover");
    const evaWarnings = telemetryWarnings.filter((w) => w.source === "eva1");

    const w = (source: "rover" | "eva1", field: string) =>
        telemetryWarnings.some(
            (warn) => warn.source === source && warn.field === field && warn.out_of_range,
        );

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
                                outsideTemperature={rover.external_temp}
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
                                height: 305,
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
                                <Oxygen
                                    level={rover.oxygen_storage ?? 0}
                                    tankLabel="Tank 1"
                                    remaining={formatRemaining(
                                        estimates.rover_oxygen_time_remaining_s,
                                    )}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                width: 240,
                                height: 419,
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
                                <Battery
                                    level={rover.primary_battery_level ?? 0}
                                    label="PR Battery"
                                    remaining={formatRemaining(
                                        estimates.rover_battery_time_remaining_s,
                                    )}
                                />
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
                                    gap: 8,
                                }}
                            >
                                <Pressure
                                    value={rover.cabin_pressure}
                                    {...ROVER_LIMITS.cabin_pressure}
                                    label={getTelemetryLabel("cabin_pressure")}
                                />
                                <Graph
                                    value={rover.oxygen_pressure}
                                    label={getTelemetryLabel("oxygen_pressure")}
                                    unit=" psi"
                                    min={ROVER_LIMITS.oxygen_pressure.min}
                                    max={ROVER_LIMITS.oxygen_pressure.max}
                                    isWarning={w("rover", "oxygen_pressure")}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                width: 419,
                                height: 305,
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
                                        {
                                            label: getTelemetryLabel("fan_pri_rpm"),
                                            rpm: rover.fan_pri_rpm ?? 0,
                                        },
                                        {
                                            label: getTelemetryLabel("fan_sec_rpm"),
                                            rpm: rover.fan_sec_rpm ?? 0,
                                        },
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
                                height: 305,
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
                                    level={eva1.oxy_pri_storage ?? 0}
                                    tankLabel="Tank 1"
                                    remaining={formatRemaining(
                                        estimates.eva_oxygen_time_remaining_s,
                                    )}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                width: 240,
                                height: 419,
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
                                <Battery
                                    level={eva1.primary_battery_level ?? 0}
                                    label="EVA 1 Battery"
                                    remaining={formatRemaining(
                                        estimates.eva_battery_time_remaining_s,
                                    )}
                                />
                            </div>
                        </Card>
                    </div>

                    {/* H — spans both rows */}
                    <Card
                        style={{
                            width: 424,
                            height: 740,
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
                                justifyContent: "flex-start",
                                paddingTop: 12,
                            }}
                        >
                            <Pressure
                                value={eva1.suit_pressure_total}
                                {...EVA_LIMITS.suit_pressure_total}
                                label={getTelemetryLabel("suit_pressure_total")}
                            />
                            <div style={{ height: "24px" }} />
                            <Graph
                                value={eva1.suit_pressure_oxy}
                                label="O2 Pressure"
                                unit=" psi"
                                min={EVA_LIMITS.suit_pressure_oxy.min}
                                max={EVA_LIMITS.suit_pressure_oxy.max}
                                windowFraction={1}
                                borderBottom={false}
                                isWarning={w("eva1", "suit_pressure_oxy")}
                            />
                            <Graph
                                value={eva1.suit_pressure_co2}
                                label="CO2 Pressure"
                                unit=" psi"
                                min={EVA_LIMITS.suit_pressure_co2.min}
                                max={EVA_LIMITS.suit_pressure_co2.max}
                                windowFraction={1}
                                borderBottom={false}
                                borderTop={false}
                                isWarning={w("eva1", "suit_pressure_co2")}
                            />
                            <Graph
                                value={eva1.scrubber_a_co2_storage}
                                label="CO2 Scrubber"
                                unit="% full"
                                min={EVA_LIMITS.scrubber_a_co2_storage.min}
                                max={EVA_LIMITS.scrubber_a_co2_storage.max}
                                borderTop={false}
                                isWarning={w("eva1", "scrubber_a_co2_storage")}
                            />
                            <OtherPressure
                                value={eva1.suit_pressure_other}
                                isWarning={w("eva1", "suit_pressure_other")}
                            />
                        </div>
                    </Card>

                    {/* Right col I + N + O */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Card
                            style={{
                                width: 453,
                                height: 244,
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
                                    bodyTemp={eva1.temperature}
                                    heartRate={eva1.heart_rate}
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
                                    co2Production={eva1.co2_production}
                                    helmetCo2Pressure={eva1.helmet_pressure_co2}
                                    co2ProductionWarning={w("eva1", "co2_production")}
                                    helmetCo2Warning={w("eva1", "helmet_pressure_co2")}
                                />
                                <Fans
                                    fans={[
                                        { label: "Fan 1", rpm: eva1.fan_pri_rpm ?? 0 },
                                        { label: "Fan 2", rpm: eva1.fan_sec_rpm ?? 0 },
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
                                    coolantStorage={eva1.coolant_storage}
                                    liquidPressure={eva1.coolant_liquid_pressure}
                                    gasPressure={eva1.coolant_gas_pressure}
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
