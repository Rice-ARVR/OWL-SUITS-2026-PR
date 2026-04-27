import styles from "./SideBar.module.css";
import Dashboard from "./Dashboard";
import RoverPanel from "./RoverPanel";
import TaskPanel from "./TaskPanel";
import BottomBar from "./BottomBar";

export default function SideBar() {
    return (
        <div className={styles.sidebar}>
            <div className={styles.topRow}>
                <Dashboard />
                <RoverPanel />
            </div>

            <div className={styles.taskWrapper}>
                <TaskPanel />
            </div>

            <BottomBar />
        </div>
    );
}
