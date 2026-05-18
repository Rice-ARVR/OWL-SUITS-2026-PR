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
    onHeadlightToggle?: (isOn: boolean) => void;
}

export default function SideBar({
    isAutonomous = false,
    onStopAutonomy,
    isSignaling = false,
    onSignalLTV,
    onHeadlightToggle,
}: SideBarProps) {
    return (
        <div className={styles.sidebar}>
            <div className={styles.taskWrapper}>
                <TaskPanel />
            </div>

            <BottomBar
                isAutonomous={isAutonomous}
                onStopAutonomy={onStopAutonomy}
                isSignaling={isSignaling}
                onSignalLTV={onSignalLTV}
                onHeadlightToggle={onHeadlightToggle}
            />
        </div>
    );
}
