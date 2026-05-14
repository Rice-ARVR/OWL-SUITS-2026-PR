import styles from "./SideBar.module.css";
import Dashboard from "./Dashboard";
import RoverPanel from "./RoverPanel";
import TaskPanel from "./TaskPanel";
import BottomBar from "./BottomBar";

interface SideBarProps {
    isAutonomous?: boolean;
    onStopAutonomy?: () => void;
    isSignaling?: boolean;
    onSignalLTV?: () => void;
}

export default function SideBar({
    isAutonomous = false,
    onStopAutonomy,
    isSignaling = false,
    onSignalLTV,
}: SideBarProps) {
    return (
        <div className={styles.sidebar}>
            <div className={styles.topRow}>
                <Dashboard />
                <RoverPanel />
            </div>

            <div className={styles.taskWrapper}>
                <TaskPanel />
            </div>

            <BottomBar
                isAutonomous={isAutonomous}
                onStopAutonomy={onStopAutonomy}
                isSignaling={isSignaling}
                onSignalLTV={onSignalLTV}
            />
        </div>
    );
}
