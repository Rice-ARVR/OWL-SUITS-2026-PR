import styles from "./Map.module.css";
import SideBar from "./sidebar/SideBar";
import TopBar from "./topbar/TopBar";
import InteractiveMap from "./interactive-map/InteractiveMap";
import { VirtualJoystick } from "~/features/controls/joystick";

export default function Map() {
    return (
        <div className={styles.layout}>
            <SideBar />
            <div className={styles.main}>
                <TopBar />
                <div className={styles.mapContainer}>
                    <InteractiveMap />
                    {/* Virtual Joystick - Bottom Left */}
                    <div style={{ position: "absolute", bottom: 16, left: 16 }}>
                        <VirtualJoystick />
                    </div>
                </div>
            </div>
        </div>
    );
}
