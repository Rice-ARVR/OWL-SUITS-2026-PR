import { useState } from "react";
import styles from "./TaskPanel.module.css";
import { AiaChat } from "../../aia/aia";

interface SubTask {
    id: number;
    title: string;
    description: string;
}

interface Task {
    id: number;
    title: string;
    description: string;
    subtasks: SubTask[];
}

const INITIAL_CURRENT: Task = {
    id: 100,
    title: "Complete Pre-Navigation Checklist",
    description:
        "Perform a series of system checks and calibrations to ensure the rover is ready for navigation.",
    subtasks: [
        {
            id: 1,
            title: "Battery Check",
            description: "Pilot verbally confirm battery level is > 95%",
        },
        {
            id: 2,
            title: "O2 Check",
            description: "Pilot verbally confirm O2 levels are > 95%",
        },
        {
            id: 3,
            title: "O2 Pressure Check",
            description: "Pilot verbally confirm O2 pressure is > 2900 psi",
        },
        {
            id: 4,
            title: "PR Cabin Pressure Check",
            description: "Pilot verbally confirm PR Cabin Pressure is > 3.95 psi ",
        },
        {
            id: 5,
            title: "PR Headlight Check",
            description:
                "Pilot verify PR headlights are operational by manually cycling lights ON, OFF, ON, OFF, ON, verbally confirm success",
        },
        {
            id: 6,
            title: "Drop Pin at Current Location",
            description: "Pilot drop pin at current location, verbally confirm success",
        },
        {
            id: 7,
            title: "Check Pin at LTV Last Known Position",
            description: "Check that pin is at LTV last known position, verbally confirm success",
        },
        {
            id: 8,
            title: "Calculate Optimal Path",
            description:
                "Start LTV Search to calculate optimal path to the LTV last nominal position",
        },
        {
            id: 9,
            title: "Announce Completion",
            description: "Verbally announce completion of checklist",
        },
    ],
};

const INITIAL_UPCOMING: Task[] = [
    {
        id: 200,
        title: "Navigate to LTV last known location",
        description:
            "Navigate to the last known location of the LTV based on telemetry data, while continuously monitoring rover systems and ensuring safe operation.",
        subtasks: [
            {
                id: 10,
                title: "Navigate to LTV Last Nominal Position",
                description: "Begin navigation to LTV last nominal position",
            },
            {
                id: 11,
                title: "Navigate to LTV Last Nominal Position",
                description: "Upon arrival, fully stop the PR, verbally confirm success",
            },
            {
                id: 12,
                title: "Announce Arrival",
                description: "Verbally announce arrival at LTV last nominal position",
            },
            {
                id: 13,
                title: "Check Telemetry",
                description:
                    "Check telemetry data and look for any off-nominal values before proceeding",
            },
            {
                id: 14,
                title: "Announce LTV Search",
                description: "Verbally announce beginning LTV search",
            },
        ],
    },
    {
        id: 300,
        title: "Initial ping and calculate search area",
        description:
            "Perform the initial ping to establish a communication link with the LTV, analyze the incoming RSSI (signal strength) data to calculate a search area, and set a pin for the next ping location based on the calculated search area.",
        subtasks: [
            {
                id: 15,
                title: "Establish Communication Link",
                description: "Send first ping, analyze the incoming RSSI (signal strength)",
            },
            {
                id: 16,
                title: "Calculate Search Area",
                description:
                    "Calculate a search area based on the LTV max speed and time away from last nominal position",
            },
            {
                id: 17,
                title: "Set Pin for Next Ping Location",
                description:
                    "Set pin for next ping location (waypoint) and calculate optimal path of navigation",
            },
            {
                id: 18,
                title: "Review Consumables",
                description:
                    "Review consumables, verify and verbally confirm point-of-no-return state is nominal",
            },
        ],
    },
    {
        id: 400,
        title: "Execute search procedure, find LTV",
        description:
            "Execute the search procedure by navigating to the next ping location, sending subsequent pings, and analyzing RSSI updates to iteratively narrow down the search area until the LTV is visually located. Verbally confirm each step of the process and ensure safe operation throughout.",
        subtasks: [
            {
                id: 19,
                title: "Navigate to Next Ping Location",
                description: "Begin navigation to next ping location",
            },
            {
                id: 20,
                title: "Announce Arrival",
                description: " Upon arrival, fully stop the PR, verbally confirm success",
            },
            {
                id: 21,
                title: "Send Ping",
                description:
                    "Send ping and wait for new RSSI value, verbally confirm new RSSI update",
            },
            {
                id: 22,
                title: "Determine Next Ping Location",
                description: "Determine next ping location based on RSSI",
            },
            {
                id: 23,
                title: "Repeat Search Procedure",
                description: "Repeat steps 1-4 until LTV is located",
            },
            {
                id: 24,
                title: "Visually Locate LTV",
                description: "Once LTV is located, verbally confirm visual of LTV",
            },
            {
                id: 25,
                title: "Drop Pin at LTV Location",
                description: "Drop pin at exact location of LTV , verbally confirm success",
            },
        ],
    },
    {
        id: 500,
        title: "Navigate back to HAB",
        description:
            "Using the last known location of the LTV, navigate back to the HAB while continuously monitoring rover systems and ensuring safe operation. Upon arrival at the HAB, verbally confirm success and announce conclusion of EVA.",
        subtasks: [
            {
                id: 26,
                title: "Calculate Optimal Path to HAB",
                description:
                    "Calculate the optimal path back to HAB using the provided map of the DUST lunar environment",
            },
            {
                id: 27,
                title: "Navigate to HAB",
                description: "Navigate back to HAB.",
            },
            {
                id: 28,
                title: "Announce Arrival at HAB",
                description:
                    " Upon arrival at the HAB, fully stop the PR, verbally confirm success",
            },
            {
                id: 29,
                title: "Announce Conclusion of EVA",
                description: "Announce arrival at HAB and conclusion of EVA",
            },
        ],
    },
];

const INITIAL_COMPLETED: Task[] = [];

interface TaskCardProps {
    task: Task;
    checkedTasks: Record<number, boolean>;
    onToggle: (id: number) => void;
    readonly?: boolean;
}

function SubtaskIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="3" rx="1" fill="currentColor" />
            <rect x="3" y="10.5" width="18" height="3" rx="1" fill="currentColor" />
            <rect x="3" y="17" width="18" height="3" rx="1" fill="currentColor" />
        </svg>
    );
}

function TaskCard({ task, checkedTasks, onToggle, readonly = false }: TaskCardProps) {
    const [expanded, setExpanded] = useState<boolean>(false);

    return (
        <div className={`${styles.taskBody} ${readonly ? styles.taskBodyCompleted : ""}`}>
            <h2 className={styles.taskTitle}>{task.title}</h2>

            {!expanded && <p className={styles.taskDesc}>{task.description}</p>}

            {expanded && (
                <div className={styles.subtasks}>
                    {task.subtasks.map((sub) => (
                        <label
                            key={sub.id}
                            className={`${styles.subtaskRow} ${readonly ? styles.subtaskRowReadonly : ""}`}
                        >
                            <input
                                type="checkbox"
                                checked={readonly ? true : !!checkedTasks[sub.id]}
                                onChange={() => {
                                    if (!readonly) onToggle(sub.id);
                                }}
                                disabled={readonly}
                                className={styles.checkbox}
                            />
                            <div className={styles.subtaskText}>
                                <span className={styles.subtaskTitle}>{sub.title}</span>
                                <span className={styles.subtaskDesc}>{sub.description}</span>
                            </div>
                        </label>
                    ))}
                </div>
            )}

            <div className={styles.taskFooter}>
                <div className={styles.footerLeft}>
                    {!expanded && (
                        <div className={styles.subtaskBadge}>
                            <SubtaskIcon />
                            <span>
                                {task.subtasks.length} subtask
                                {task.subtasks.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>
                <button onClick={() => setExpanded(!expanded)} className={styles.chevronBtn}>
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#888"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`${styles.chevronIcon} ${!expanded ? styles.chevronIconCollapsed : ""}`}
                    >
                        <polyline points="18 15 12 9 6 15" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

type Tab = "tasks" | "assistant";

export default function TaskPanel() {
    const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [current, setCurrent] = useState<Task | null>(INITIAL_CURRENT);
    const [upcoming, setUpcoming] = useState<Task[]>(INITIAL_UPCOMING);
    const [completed, setCompleted] = useState<Task[]>(INITIAL_COMPLETED);
    const [activeTab, setActiveTab] = useState<Tab>("tasks");

    const toggleTask = (id: number): void => {
        const next = { ...checkedTasks, [id]: !checkedTasks[id] };
        setCheckedTasks(next);

        // Sync with backend
        const endpoint = next[id]
            ? `/procedures/${id}/set_complete`
            : `/procedures/${id}/set_incomplete`;
        fetch(endpoint, { method: "PATCH" }).catch((err) =>
            console.error("Failed to sync procedure:", err),
        );

        // Check if all subtasks of current task are now checked
        if (current) {
            const allDone = current.subtasks.every((sub) => next[sub.id]);
            if (allDone) {
                setTimeout(() => {
                    setCompleted((prev) => [current, ...prev]);
                    if (upcoming.length > 0) {
                        setCurrent(upcoming[0]);
                        setUpcoming((prev) => prev.slice(1));
                    } else {
                        setCurrent(null);
                    }
                }, 400);
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Tab header */}
                <div className={styles.tabHeader}>
                    <span className={styles.tabTitle}>
                        {activeTab === "tasks" ? "Current Task" : "Sammy Assistant"}
                    </span>
                    <div className={styles.tabIcons}>
                        <button
                            className={`${styles.tabBtn} ${activeTab === "tasks" ? styles.tabBtnActive : ""}`}
                            onClick={() => setActiveTab("tasks")}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <rect
                                    x="3"
                                    y="4"
                                    width="18"
                                    height="3"
                                    rx="1"
                                    fill="currentColor"
                                />
                                <rect
                                    x="3"
                                    y="10.5"
                                    width="18"
                                    height="3"
                                    rx="1"
                                    fill="currentColor"
                                />
                                <rect
                                    x="3"
                                    y="17"
                                    width="18"
                                    height="3"
                                    rx="1"
                                    fill="currentColor"
                                />
                            </svg>
                        </button>
                        <button
                            className={`${styles.tabBtn} ${activeTab === "assistant" ? styles.tabBtnActive : ""}`}
                            onClick={() => setActiveTab("assistant")}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tasks tab */}
                <div style={{ display: activeTab === "tasks" ? "contents" : "none" }}>
                    <div className={styles.scrollArea}>
                        {current && (
                            <TaskCard
                                task={current}
                                checkedTasks={checkedTasks}
                                onToggle={toggleTask}
                            />
                        )}

                        {!current && (
                            <div className={styles.allDone}>
                                <span>All tasks completed</span>
                            </div>
                        )}

                        {upcoming.length > 0 && (
                            <>
                                <span className={styles.sectionLabel}>Upcoming tasks</span>
                                {upcoming.map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        checkedTasks={checkedTasks}
                                        onToggle={toggleTask}
                                    />
                                ))}
                            </>
                        )}
                    </div>

                    <div className={styles.completedSection}>
                        {completedExpanded && completed.length > 0 && (
                            <div className={styles.completedList}>
                                {completed.map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        checkedTasks={checkedTasks}
                                        onToggle={toggleTask}
                                        readonly
                                    />
                                ))}
                            </div>
                        )}
                        <button
                            className={styles.completedRow}
                            onClick={() => setCompletedExpanded(!completedExpanded)}
                        >
                            <span className={styles.completedText}>
                                {completed.length} task{completed.length !== 1 ? "s" : ""} completed
                            </span>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#888"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`${styles.chevronIcon} ${completedExpanded ? styles.completedChevronOpen : ""}`}
                            >
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Assistant tab */}
                <div
                    className={styles.assistantContent}
                    style={{ display: activeTab === "assistant" ? undefined : "none" }}
                >
                    <AiaChat />
                </div>
            </div>
        </div>
    );
}
