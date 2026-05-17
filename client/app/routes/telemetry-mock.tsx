import { useEffect, useState } from "react";
import Card from "~/components/ui/Card";
import Battery from "~/components/ui/Battery";
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
import styles from "~/features/task-board/telemetry.module.css";
import { EVA_LIMITS, ROVER_LIMITS } from "~/constants/telemetryLimits";
import type { Warning } from "~/types/warning";

export default function TelemetryMock() {
    const [time, setTime] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTime((t) => (t + 1) % 60);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Mock data that changes over time
    const roverWarnings: Warning[] | undefined = [];
    const evaWarnings: Warning[] | undefined = [];
    const throttle = Math.sin(time / 10) * 50;
    const speed = Math.abs(Math.sin(time / 15)) * 5;

    return (
        <div className={styles.container}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Row 1 */}
                <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
                    <Card style={{ flex: "1 1 auto", minWidth: 0, padding: 0, aspectRatio: "314/384" }} title="A">
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
                    <Card style={{ flex: "1.1 1 auto", minWidth: 0, aspectRatio: "345/384" }} title="B">
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
                                temperature={21 + Math.sin(time / 10) * 5}
                                outsideTemperature={-40 + Math.sin(time / 15) * 10}
                                target={21}
                            />
                        </div>
                    </Card>
                    <Card
                        style={{
                            flex: "1 1 auto",
                            minWidth: 0,
                            padding: 0,
                            marginLeft: 16,
                            aspectRatio: "314/384",
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
                            flex: "2.6 1 auto",
                            minWidth: 0,
                            overflow: "hidden",
                            aspectRatio: "823/384",
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
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: 1, minHeight: 0 }}>
                    {/* Col E + J */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "0.76 1 auto", minWidth: 0 }}>
                        <Card
                            style={{
                                flex: "1 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "240/275",
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
                                    level={50 + Math.sin(time / 20) * 20}
                                    tankLabel="Tank 1"
                                    remaining="04:32:10 Remaining"
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                flex: "1.22 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "240/335",
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
                                    level={75 + Math.sin(time / 25) * 15}
                                    label="PR Battery"
                                    remaining="08:15:30 Remaining"
                                />
                            </div>
                        </Card>
                    </div>

                    {/* Col F + K */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "1.34 1 auto", minWidth: 0 }}>
                        <Card
                            style={{
                                flex: "1.22 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "419/335",
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
                                    value={4.2 + Math.sin(time / 15) * 0.3}
                                    {...ROVER_LIMITS.cabin_pressure}
                                    label="Cabin Pressure"
                                />
                                <Graph
                                    value={3.5 + Math.sin(time / 12) * 0.5}
                                    label="O2 Pressure"
                                    unit=" psi"
                                    min={ROVER_LIMITS.oxygen_pressure.min}
                                    max={ROVER_LIMITS.oxygen_pressure.max}
                                    isWarning={false}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                flex: "1 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "419/275",
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
                                    storage={60 + Math.sin(time / 18) * 15}
                                    pressure={500 + Math.cos(time / 20) * 50}
                                    storageWarning={false}
                                    pressureWarning={false}
                                />
                                <Fans
                                    fans={[
                                        {
                                            label: "Fan 1",
                                            rpm: Math.abs(Math.sin(time / 10)) * 3000,
                                        },
                                        {
                                            label: "Fan 2",
                                            rpm: Math.abs(Math.cos(time / 10)) * 3000,
                                        },
                                    ]}
                                    fanWarnings={[false, false]}
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
                            flex: "0.76 1 auto",
                            minWidth: 0,
                        }}
                    >
                        <Card
                            style={{
                                flex: "1 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "240/275",
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
                                    level={45 + Math.sin(time / 22) * 18}
                                    tankLabel="Tank 1"
                                    remaining="03:45:20 Remaining"
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                flex: "1.22 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "240/335",
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
                                    level={82 + Math.sin(time / 28) * 12}
                                    label="EVA 1 Battery"
                                    remaining="06:22:15 Remaining"
                                />
                            </div>
                        </Card>
                    </div>

                    {/* H — spans both rows */}
                    <Card
                        style={{
                            flex: "1.35 1 auto",
                            minWidth: 0,
                            overflow: "hidden",
                            aspectRatio: "424/626",
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
                                value={4.1 + Math.sin(time / 14) * 0.4}
                                {...EVA_LIMITS.suit_pressure_total}
                                label="Total Suit Pressure"
                            />
                            <div style={{ height: "34px" }} />
                            <Graph
                                value={3.2 + Math.sin(time / 11) * 0.3}
                                label="O2 Pressure"
                                unit=" psi"
                                min={EVA_LIMITS.suit_pressure_oxy.min}
                                max={EVA_LIMITS.suit_pressure_oxy.max}
                                windowFraction={1}
                                borderBottom={false}
                                isWarning={false}
                            />
                            <Graph
                                value={0.8 + Math.cos(time / 13) * 0.2}
                                label="CO2 Pressure"
                                unit=" psi"
                                min={EVA_LIMITS.suit_pressure_co2.min}
                                max={EVA_LIMITS.suit_pressure_co2.max}
                                windowFraction={1}
                                borderBottom={false}
                                borderTop={false}
                                isWarning={false}
                            />
                            <Graph
                                value={35 + Math.sin(time / 16) * 20}
                                label="CO2 Scrubber"
                                unit="% full"
                                min={EVA_LIMITS.scrubber_a_co2_storage.min}
                                max={EVA_LIMITS.scrubber_a_co2_storage.max}
                                borderTop={false}
                                isWarning={false}
                            />
                            <OtherPressure
                                value={2.5 + Math.sin(time / 17) * 0.3}
                                isWarning={false}
                            />
                        </div>
                    </Card>

                    {/* Right col I + N + O */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "1.44 1 auto", minWidth: 0 }}>
                        <Card
                            style={{
                                flex: "0.4 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                padding: "0 16px",
                                gap: 0,
                                aspectRatio: "453/124",
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
                                    bodyTemp={37.2 + Math.sin(time / 12) * 0.8}
                                    heartRate={72 + Math.sin(time / 8) * 12}
                                    bodyTempWarning={false}
                                    heartRateWarning={false}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                flex: "0.92 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "453/289",
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
                                    co2Production={120 + Math.sin(time / 10) * 30}
                                    helmetCo2Pressure={0.6 + Math.sin(time / 9) * 0.15}
                                    co2ProductionWarning={false}
                                    helmetCo2Warning={false}
                                />
                                <Fans
                                    fans={[
                                        { label: "Fan 1", rpm: Math.abs(Math.sin(time / 11)) * 2500 },
                                        { label: "Fan 2", rpm: Math.abs(Math.cos(time / 11)) * 2500 },
                                    ]}
                                    fanWarnings={[false, false]}
                                />
                            </div>
                        </Card>
                        <Card
                            style={{
                                flex: "0.56 1 auto",
                                minHeight: 0,
                                overflow: "hidden",
                                aspectRatio: "453/175",
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
                                    coolantStorage={55 + Math.sin(time / 19) * 18}
                                    liquidPressure={480 + Math.sin(time / 21) * 40}
                                    gasPressure={520 + Math.cos(time / 21) * 35}
                                    liquidWarning={false}
                                    gasWarning={false}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
