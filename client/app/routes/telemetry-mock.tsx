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
import { EVA_LIMITS, ROVER_LIMITS } from "~/constants/telemetryLimits";

const BASE_W = 1800;
const BASE_H = 960;

const INNER: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 0,
};

export default function TelemetryMock() {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
            <div style={{
                width: BASE_W,
                height: BASE_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 16,
                boxSizing: "border-box",
            }}>
                <div style={{ display: "flex", gap: 16, flex: "0 0 340px" }}>
                    <Card style={{ flex: "1 1 auto", padding: 0 }}>
                        <div style={INNER}><Summary showReflection={false} warnings={[]} /></div>
                    </Card>
                    <Card style={{ flex: "1.1 1 auto", overflow: "hidden" }}>
                        <div style={INNER}><Temperature temperature={21} outsideTemperature={-40} target={21} /></div>
                    </Card>
                    <Card style={{ flex: "1 1 auto", padding: 0 }}>
                        <div style={INNER}><Summary image="/astronaut.png" label="EVA 1" showReflection={false} warnings={[]} /></div>
                    </Card>
                    <Card style={{ flex: "2.6 1 auto" }}>
                        <img src="/moon.png" alt="Moon" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                    </Card>
                </div>
                <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "0.76 1 auto" }}>
                        <Card style={{ flex: 1 }}>
                            <div style={INNER}><Oxygen level={70} tankLabel="Tank 1" remaining="04:32:10 Remaining" /></div>
                        </Card>
                        <Card style={{ flex: 1 }}>
                            <div style={INNER}><Battery level={75} label="PR Battery" remaining="08:15:30 Remaining" /></div>
                        </Card>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "1.34 1 auto" }}>
                        <Card style={{ flex: 1 }}>
                            <div style={{ ...INNER, gap: 50 }}>
                                <Pressure value={4.2} {...ROVER_LIMITS.cabin_pressure} label="Cabin Pressure" />
                                <Graph value={3.5} label="O2 Pressure" unit=" psi" min={ROVER_LIMITS.oxygen_pressure.min} max={ROVER_LIMITS.oxygen_pressure.max} isWarning={false} />
                            </div>
                        </Card>
                        <Card style={{ flex: 1 }}>
                            <div style={{ ...INNER, gap: 24 }}>
                                <Coolant storage={60} pressure={500} storageWarning={false} pressureWarning={false} />
                                <Fans fans={[{ label: "Fan 1", rpm: 2400 }, { label: "Fan 2", rpm: 2200 }]} fanWarnings={[false, false]} />
                            </div>
                        </Card>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "0.76 1 auto" }}>
                        <Card style={{ flex: 1 }}>
                            <div style={INNER}><Oxygen level={63} tankLabel="Tank 1" remaining="03:45:20 Remaining" /></div>
                        </Card>
                        <Card style={{ flex: 1 }}>
                            <div style={INNER}><Battery level={82} label="EVA 1 Battery" remaining="06:22:15 Remaining" /></div>
                        </Card>
                    </div>
                    <Card style={{ flex: "1.35 1 auto" }}>
                        <div style={{ ...INNER, justifyContent: "flex-start", paddingTop: 8, paddingBottom: 0, gap: 0 }}>
                            <Pressure value={4.1} {...EVA_LIMITS.suit_pressure_total} label="Total Suit Pressure" />
                            <div style={{ height: 120 }} />
                            <Graph value={3.2} label="O2 Pressure" unit=" psi" min={EVA_LIMITS.suit_pressure_oxy.min} max={EVA_LIMITS.suit_pressure_oxy.max} windowFraction={1} borderBottom={false} isWarning={false} />
                            <Graph value={0.8} label="CO2 Pressure" unit=" psi" min={EVA_LIMITS.suit_pressure_co2.min} max={EVA_LIMITS.suit_pressure_co2.max} windowFraction={1} borderBottom={false} borderTop={false} isWarning={false} />
                            <Graph value={35} label="CO2 Scrubber" unit="% full" min={EVA_LIMITS.scrubber_a_co2_storage.min} max={EVA_LIMITS.scrubber_a_co2_storage.max} borderTop={false} isWarning={false} />
                            <OtherPressure value={2.5} isWarning={false} />
                        </div>
                    </Card>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: "1.44 1 auto" }}>
                        <Card style={{ flex: "0.4 1 auto", padding: "0 16px" }}>
                            <div style={INNER}><Health bodyTemp={37.2} heartRate={72} bodyTempWarning={false} heartRateWarning={false} /></div>
                        </Card>
                        <Card style={{ flex: "0.92 1 auto" }}>
                            <div style={{ ...INNER, gap: 20 }}>
                                <CO2 co2Production={120} helmetCo2Pressure={0.6} co2ProductionWarning={false} helmetCo2Warning={false} />
                                <Fans fans={[{ label: "Fan 1", rpm: 2500 }, { label: "Fan 2", rpm: 2300 }]} fanWarnings={[false, false]} />
                            </div>
                        </Card>
                        <Card style={{ flex: "0.56 1 auto" }}>
                            <div style={INNER}><EVACoolant coolantStorage={55} liquidPressure={480} gasPressure={520} liquidWarning={false} gasWarning={false} /></div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
