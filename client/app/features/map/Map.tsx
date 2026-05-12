import styles from "./Map.module.css";
import SideBar from "./sidebar/SideBar";
import TopBar from "./topbar/TopBar";
import InteractiveMap from "./interactive-map/InteractiveMap";

export default function Map() {
    return (
        <div className={styles.layout}>
            <SideBar />
            <div className={styles.main}>
                <TopBar />
                <div className={styles.mapContainer}>
                    <InteractiveMap />
                </div>
            </div>
        </div>
    );
}
