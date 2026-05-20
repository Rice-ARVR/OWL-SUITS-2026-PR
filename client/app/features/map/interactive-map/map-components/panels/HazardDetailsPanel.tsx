import styles from "../../InteractiveMap.module.css";
import type { HazardType } from "~/types/map";

interface HazardDetailsPanelProps {
    selectedTypes: HazardType[];
    toggleHazardType: (type: HazardType) => void;
    onCancel: () => void;
    onFinish: () => void;
}

export function HazardDetailsPanel({
    selectedTypes,
    toggleHazardType,
    onCancel,
    onFinish,
}: HazardDetailsPanelProps) {
    return (
        <div className={styles.panel} style={{ position: "relative" }}>
            <div className={styles.panelHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <polygon
                        points="12,2 22,20 2,20"
                        stroke="#ff8a75"
                        strokeWidth="2"
                        fill="none"
                    />
                </svg>
                <span className={styles.panelTitle}>Add Details</span>
                <button className={styles.panelClose} onClick={onCancel}>
                    ×
                </button>
            </div>

            <div className={styles.detailsBody}>
                <span className={styles.detailsLabel}>Hazard Type</span>
                <div className={styles.typeChips}>
                    {(["regolith", "debris", "crater"] as HazardType[]).map((type) => (
                        <button
                            key={type}
                            className={`${styles.typeChip} ${
                                selectedTypes.includes(type) ? styles.typeChipSelected : ""
                            }`}
                            onClick={() => toggleHazardType(type)}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <button className={styles.finishBtn} onClick={onFinish}>
                Finish
            </button>
        </div>
    );
}
