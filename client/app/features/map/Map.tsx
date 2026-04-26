import styles from "./Map.module.css";
import Dashboard from "./sidebar/Dashboard";
import RoverPanel from "./sidebar/RoverPanel";
import TaskPanel from "./sidebar/TaskPanel";
import InteractiveMap from "./interactive-map/InteractiveMap";
import BottomBar from "./sidebar/BottomBar";
import TopBar from "./topbar/TopBar";

export default function Map() {
    return (
        <>
            <Dashboard></Dashboard>
            <RoverPanel></RoverPanel>
            <TaskPanel></TaskPanel>
            <BottomBar></BottomBar>
            <InteractiveMap></InteractiveMap>
            <TopBar></TopBar>
        </>
    );
}
