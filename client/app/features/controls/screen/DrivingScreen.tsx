import { useState } from "react";
import Dashboard from "~/features/map/sidebar/Dashboard";
import RoverPanel from "~/features/map/sidebar/RoverPanel";
import DustStreamView from "./DustStreamView";
import DustCVStreamView from "./DustCVStreamView";
import Minimap from "./Minimap";
import styles from "./DrivingScreen.module.css";

type StreamId = "dust" | "cv";

export default function DrivingScreen() {
    const [primaryStream, setPrimaryStream] = useState<StreamId>("dust");

    const swap = () => setPrimaryStream((prev) => (prev === "dust" ? "cv" : "dust"));

    const PrimaryComponent = primaryStream === "dust" ? DustStreamView : DustCVStreamView;
    const SecondaryComponent = primaryStream === "dust" ? DustCVStreamView : DustStreamView;

    return (
        <div className={styles.root}>
            <div className={styles.leftColumn}>
                <div className={styles.topRow}>
                    <Dashboard />
                    <RoverPanel />
                    <div className={styles.panel}>
                        <h2>Placeholder</h2>
                    </div>
                </div>
                <div className={styles.panel + " " + styles.bottomRow}>
                    <div
                        className={styles.primaryStream}
                        onClick={swap}
                        title="Click to swap streams"
                    >
                        <PrimaryComponent />
                    </div>
                </div>
            </div>

            <div className={styles.rightColumn}>
                <div className={`${styles.panel} ${styles.secondStreamPanel}`}>
                    <div
                        className={styles.secondaryStream}
                        onClick={swap}
                        title="Click to swap streams"
                    >
                        <SecondaryComponent />
                    </div>
                    <div className={styles.aiInformation}>
                        <h5>Place holder</h5>
                    </div>
                </div>
                <div className={styles.panel}>
                    <Minimap />
                </div>
            </div>
        </div>
    );
}
