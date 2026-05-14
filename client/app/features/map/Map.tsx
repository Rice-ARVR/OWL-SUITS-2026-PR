import { useState, useRef, useCallback } from "react";
import styles from "./Map.module.css";
import SideBar from "./sidebar/SideBar";
import TopBar from "./topbar/TopBar";
import InteractiveMap from "./interactive-map/InteractiveMap";

export default function Map() {
    const [isAutonomous, setIsAutonomous] = useState(false);
    const stopAutonomyRef = useRef<(() => void) | undefined>(undefined);

    const [isSignaling, setIsSignaling] = useState(false);
    const signalingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSignalLTV = useCallback(() => {
        if (isSignaling) return;
        setIsSignaling(true);

        // TODO: call backend ping endpoint here

        // Auto-dismiss after 3 seconds
        if (signalingTimer.current) clearTimeout(signalingTimer.current);
        signalingTimer.current = setTimeout(() => {
            setIsSignaling(false);
        }, 3000);
    }, [isSignaling]);

    return (
        <div className={styles.layout}>
            <SideBar
                isAutonomous={isAutonomous}
                onStopAutonomy={() => stopAutonomyRef.current?.()}
                isSignaling={isSignaling}
                onSignalLTV={handleSignalLTV}
            />

            <div className={styles.main}>
                <TopBar />
                <div className={styles.mapContainer}>
                    <InteractiveMap
                        onAutonomyChange={setIsAutonomous}
                        stopAutonomyRef={stopAutonomyRef}
                        isSignaling={isSignaling}
                    />
                </div>
            </div>
        </div>
    );
}
