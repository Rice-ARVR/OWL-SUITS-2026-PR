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
    id: 1,
    title: "Find lost LTV",
    description: "Locate the non-communicating autonomous Lunar Terrain Vehicle (LTV).",
    subtasks: [
        {
            id: 101,
            title: "Map Search Pattern",
            description: "Generate a grid based on last known location and terrain.",
        },
        {
            id: 102,
            title: "Lorem Ipsum",
            description: "Navigate the rover to locate the LTV within the search radius.",
        },
        {
            id: 103,
            title: "Initiate LTV Wake-up",
            description: "Send a beacon signal to trigger the LTV's response when in range.",
        },
    ],
};

const INITIAL_UPCOMING: Task[] = [
    {
        id: 2,
        title: "EV Navigation",
        description: "Traverse the lunar surface safely while detecting environmental hazards.",
        subtasks: [
            {
                id: 201,
                title: "Map Search Pattern",
                description: "Generate a grid based on last known location and terrain.",
            },
            {
                id: 202,
                title: "Lorem Ipsum",
                description: "Navigate the rover to locate the LTV within the search radius.",
            },
            {
                id: 203,
                title: "Initiate LTV Wake-up",
                description: "Send a beacon signal to trigger the LTV's response when in range.",
            },
        ],
    },
    {
        id: 3,
        title: "Egress",
        description:
            "Complete specific Umbilical Interface Assembly (UIA) procedures to safely exit the airlock and initiate the EVA.",
        subtasks: [
            {
                id: 301,
                title: "Prepare airlock",
                description: "Run depressurization sequence and verify seal integrity.",
            },
        ],
    },
];

const INITIAL_COMPLETED: Task[] = [
    {
        id: 4,
        title: "LTV Repair",
        description:
            "EV must follow AI-guided procedures to diagnose and perform physical repairs on the malfunctioning LTV.",
        subtasks: [
            {
                id: 401,
                title: "Run diagnostics",
                description: "Execute full system diagnostic scan on the LTV.",
            },
            {
                id: 402,
                title: "Replace power cell",
                description: "Swap the depleted power cell with a charged replacement.",
            },
        ],
    },
];

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
                {activeTab === "tasks" && (
                    <>
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
                                    {completed.length} task{completed.length !== 1 ? "s" : ""}{" "}
                                    completed
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
                    </>
                )}

                {/* Assistant tab */}
                {activeTab === "assistant" && (
                    <div className={styles.assistantContent}>
                        <AiaChat></AiaChat>
                    </div>
                )}
            </div>
        </div>
    );
}
