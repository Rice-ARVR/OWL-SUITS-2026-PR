import { useState, useRef, useCallback } from "react";
import styles from "./Map.module.css";
import SideBar from "./sidebar/SideBar";
import TopBar from "./topbar/TopBar";
import InteractiveMap from "./interactive-map/InteractiveMap";

export type ManualPingResult = {
    rssi_value: number;
    category: string;
} | null;

export default function Map() {
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [currentTargetPos, setCurrentTargetPos] = useState<{ x: number; y: number } | null>(null);
    const stopAutonomyRef = useRef<(() => void) | undefined>(undefined);

    const [isSignaling, setIsSignaling] = useState(false);
    const [signalStatus, setSignalStatus] = useState<
        "pending" | "success" | "failed" | "not in range"
    >("pending");
    const [lastManualPing, setLastManualPing] = useState<ManualPingResult>(null);
    const signalingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [headlightNotice, setHeadlightNotice] = useState<"on" | "off" | null>(null);
    const headlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleHeadlightToggle = useCallback((isOn: boolean) => {
        setHeadlightNotice(isOn ? "on" : "off");
        if (headlightTimer.current) clearTimeout(headlightTimer.current);
        headlightTimer.current = setTimeout(() => {
            setHeadlightNotice(null);
        }, 2000);
    }, []);

    const handleSignalLTV = useCallback(() => {
        if (isSignaling) return;
        setIsSignaling(true);
        setSignalStatus("pending");

        fetch(`${import.meta.env.VITE_API_URL ?? ""}/navigation/ping/execute`, { method: "POST" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        if (data.rssi_value != 1) {
                            setLastManualPing({
                                rssi_value: data.rssi_value,
                                category: data.category,
                            });
                            setSignalStatus("success");
                        } else {
                            setSignalStatus("not in range");
                        }
                    } else {
                        setSignalStatus("failed");
                    }
                } else {
                    setSignalStatus("failed");
                }
            })
            .catch(() => {
                setSignalStatus("failed");
            })
            .finally(() => {
                if (signalingTimer.current) clearTimeout(signalingTimer.current);
                signalingTimer.current = setTimeout(() => {
                    setIsSignaling(false);
                    setSignalStatus("pending");
                }, 2000);
            });
    }, [isSignaling]);

    return (
        <div className={styles.layout}>
            <div className={styles.main}>
                <TopBar isAutonomous={isAutonomous} currentTargetPos={currentTargetPos} />
                <div className={styles.mapContainer}>
                    <InteractiveMap
                        onAutonomyChange={setIsAutonomous}
                        onCurrentTargetChange={setCurrentTargetPos}
                        stopAutonomyRef={stopAutonomyRef}
                        isSignaling={isSignaling}
                        signalStatus={signalStatus}
                        lastManualPing={lastManualPing}
                        headlightNotice={headlightNotice}
                    />
                </div>
            </div>
            <SideBar
                isAutonomous={isAutonomous}
                onStopAutonomy={() => stopAutonomyRef.current?.()}
                isSignaling={isSignaling}
                onSignalLTV={handleSignalLTV}
                onHeadlightToggle={handleHeadlightToggle}
            />
        </div>
    );
}
