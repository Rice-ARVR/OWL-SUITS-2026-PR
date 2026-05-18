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
import TelemetryHighlight, { type Severity } from "~/components/ui/TelemetryHighlight";
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
                try { setTelemetryWarnings(JSON.parse(event.data as string) as Warning[]); } catch { }
            };
            ws.onclose = () => { if (active) reconnectTimeout = setTimeout(connect, 1000); };
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
        telemetryWarnings.some((warn) => warn.source === source && warn.field === field && warn.out_of_range);
    const worst = (ws: Warning[]): Severity =>
        ws.some((x) => x.out_of_range) ? "critical" : ws.some((x) => x.off_nominal) ? "warning" : "nominal";
    const sev = (source: "rover" | "eva1", ...fields: string[]): Severity =>
        worst(telemetryWarnings.filter((x) => x.source === source && fields.includes(x.field)));

    return (
        <div className={styles.root}>
            <div className={styles.inner}>
                {/* Rover frame — 675px fixed */}
                <div className={styles.roverFrame}>
                    {/* Rover Row 1: Summary + Temperature */}
                    <div className={styles.roverRow1}>
                        <Card className={styles.summaryCard} severity={worst(roverWarnings)}>
                            <Summary showReflection={false} warnings={roverWarnings} />
                        </Card>
                        <Card className={styles.temperatureCard} severity={sev("rover", "cabin_temperature")}>
                            <Temperature temperature={rover.cabin_temperature} outsideTemperature={rover.external_temp} target={rover.cabin_temperature_target} />
                        </Card>
                    </div>
                    {/* Rover Row 2: Oxygen + Battery | Pressure + Coolant */}
                    <div className={styles.roverRow2}>
                        <div className={styles.roverRow2LeftStack}>
                            <Card className={styles.oxygenCard} severity={sev("rover", "oxygen_storage")}>
                                <Oxygen level={rover.oxygen_storage ?? 0} tankLabel="Tank 1" remaining={formatRemaining(estimates.rover_oxygen_time_remaining_s)} />
                            </Card>
                            <Card className={styles.batteryCard} padding="25px 20px" severity={sev("rover", "primary_battery_level")}>
                                <Battery level={rover.primary_battery_level ?? 0} label="PR Battery" remaining={formatRemaining(estimates.rover_battery_time_remaining_s)} />
                            </Card>
                        </div>
                        <div className={styles.roverRow2RightStack}>
                            <Card className={styles.pressureCard} padding="24px 20px 20px 20px">
                                <TelemetryHighlight severity={sev("rover", "cabin_pressure")} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                                    <Pressure value={rover.cabin_pressure} {...ROVER_LIMITS.cabin_pressure} label={getTelemetryLabel("cabin_pressure")} />
                                </TelemetryHighlight>
                                <TelemetryHighlight severity={sev("rover", "oxygen_pressure")} style={{ width: "100%" }}>
                                    <Graph value={rover.oxygen_pressure} label={getTelemetryLabel("oxygen_pressure")} unit=" psi" min={ROVER_LIMITS.oxygen_pressure.min} max={ROVER_LIMITS.oxygen_pressure.max} isWarning={w("rover", "oxygen_pressure")} />
                                </TelemetryHighlight>
                            </Card>
                            <Card className={styles.coolantCard} padding="20px 20px 20px 25px">
                                <TelemetryHighlight severity={sev("rover", "coolant_storage", "coolant_pressure")} style={{ width: "100%" }}>
                                    <Coolant storage={rover.coolant_storage} pressure={rover.coolant_pressure} storageWarning={w("rover", "coolant_storage")} pressureWarning={w("rover", "coolant_pressure")} />
                                </TelemetryHighlight>
                                <TelemetryHighlight severity={sev("rover", "fan_pri_rpm", "fan_sec_rpm")} style={{ width: "100%" }}>
                                    <Fans fans={[{ label: getTelemetryLabel("fan_pri_rpm"), rpm: rover.fan_pri_rpm ?? 0 }, { label: getTelemetryLabel("fan_sec_rpm"), rpm: rover.fan_sec_rpm ?? 0 }]} fanWarnings={[w("rover", "fan_pri_rpm"), w("rover", "fan_sec_rpm")]} />
                                </TelemetryHighlight>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* EVA frame — flexes to fill remaining 1153px */}
                <div className={styles.evaFrame}>
                    {/* EVA Row 1: EVA Summary + Moon */}
                    <div className={styles.evaRow1}>
                        <Card className={styles.evaSummaryCard} padding="20px 26px 20px 23px" severity={worst(evaWarnings)}>
                            <Summary image="/astronaut.png" label="EVA 1" showReflection={false} warnings={evaWarnings} />
                        </Card>
                        <Card className={styles.moonCard}>
                            <img src="/moon.png" alt="Moon" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                        </Card>
                    </div>
                    {/* EVA Row 2: EVA Oxygen + Battery | EVA Suit Pressure | EVA Health + CO2 + Coolant */}
                    <div className={styles.evaRow2}>
                        <div className={styles.evaRow2Stack1}>
                            <Card className={styles.oxygenCard} severity={sev("eva1", "oxy_pri_storage")}>
                                <Oxygen level={eva1.oxy_pri_storage ?? 0} tankLabel="Tank 1" remaining={formatRemaining(estimates.eva_oxygen_time_remaining_s)} />
                            </Card>
                            <Card className={styles.batteryCard} padding="25px 20px" severity={sev("eva1", "primary_battery_level")}>
                                <Battery level={eva1.primary_battery_level ?? 0} label="EVA 1 Battery" remaining={formatRemaining(estimates.eva_battery_time_remaining_s)} />
                            </Card>
                        </div>
                        <Card className={styles.suitPressureCard} severity={sev("eva1", "suit_pressure_total", "suit_pressure_oxy", "suit_pressure_co2", "scrubber_a_co2_storage", "suit_pressure_other")}>
                            <div className={styles.suitPressureGauge}>
                                <Pressure value={eva1.suit_pressure_total} {...EVA_LIMITS.suit_pressure_total} label={getTelemetryLabel("suit_pressure_total")} />
                            </div>
                            <div className={styles.suitGraphsCard}>
                                <Graph value={eva1.suit_pressure_oxy} label="O2 Pressure" unit=" psi" min={EVA_LIMITS.suit_pressure_oxy.min} max={EVA_LIMITS.suit_pressure_oxy.max} windowFraction={1} borderBottom={false} isWarning={w("eva1", "suit_pressure_oxy")} />
                                <Graph value={eva1.suit_pressure_co2} label="CO2 Pressure" unit=" psi" min={EVA_LIMITS.suit_pressure_co2.min} max={EVA_LIMITS.suit_pressure_co2.max} windowFraction={1} borderBottom={false} borderTop={false} isWarning={w("eva1", "suit_pressure_co2")} />
                                <Graph value={eva1.scrubber_a_co2_storage} label="CO2 Scrubber" unit="% full" min={EVA_LIMITS.scrubber_a_co2_storage.min} max={EVA_LIMITS.scrubber_a_co2_storage.max} borderTop={false} isWarning={w("eva1", "scrubber_a_co2_storage")} />
                            </div>
                            <div className={styles.otherPressureCard}>
                                <OtherPressure value={eva1.suit_pressure_other} isWarning={w("eva1", "suit_pressure_other")} />
                            </div>
                        </Card>
                        <div className={styles.evaRow2Stack3}>
                            <Card className={styles.evaStack3Card} padding="20px 30px" severity={sev("eva1", "temperature", "heart_rate")}>
                                <Health bodyTemp={eva1.temperature} heartRate={eva1.heart_rate} bodyTempWarning={w("eva1", "temperature")} heartRateWarning={w("eva1", "heart_rate")} />
                            </Card>
                            <Card className={styles.evaStack3Card} padding="20px">
                                <TelemetryHighlight severity={sev("eva1", "co2_production", "helmet_pressure_co2")} radius={10} style={{ width: "100%" }}>
                                    <CO2 co2Production={eva1.co2_production} helmetCo2Pressure={eva1.helmet_pressure_co2} co2ProductionWarning={w("eva1", "co2_production")} helmetCo2Warning={w("eva1", "helmet_pressure_co2")} />
                                </TelemetryHighlight>
                                <TelemetryHighlight severity={sev("eva1", "fan_pri_rpm", "fan_sec_rpm")} style={{ width: "100%" }}>
                                    <Fans fans={[{ label: "Fan 1", rpm: eva1.fan_pri_rpm ?? 0 }, { label: "Fan 2", rpm: eva1.fan_sec_rpm ?? 0 }]} fanWarnings={[w("eva1", "fan_pri_rpm"), w("eva1", "fan_sec_rpm")]} />
                                </TelemetryHighlight>
                            </Card>
                            <Card className={styles.evaStack3Card} padding="20px 20px 20px 25px" severity={sev("eva1", "coolant_storage", "coolant_liquid_pressure", "coolant_gas_pressure")}>
                                <EVACoolant coolantStorage={eva1.coolant_storage} liquidPressure={eva1.coolant_liquid_pressure} gasPressure={eva1.coolant_gas_pressure} liquidWarning={w("eva1", "coolant_liquid_pressure")} gasWarning={w("eva1", "coolant_gas_pressure")} />
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
