import styles from "../../InteractiveMap.module.css";

interface ManualConfirmModalProps {
    onCancel: () => void;
    onConfirm: () => void;
}

export function ManualConfirmModal({ onCancel, onConfirm }: ManualConfirmModalProps) {
    return (
        <div className={styles.confirmOverlay}>
            <div className={styles.confirmBox}>
                <p className={styles.confirmText}>
                    Are you sure? This will stop autonomous navigation.
                </p>
                <div className={styles.confirmActions}>
                    <button className={styles.confirmCancelBtn} onClick={onCancel}>
                        Cancel
                    </button>
                    <button className={styles.confirmStopBtn} onClick={onConfirm}>
                        Stop Autonomy
                    </button>
                </div>
            </div>
        </div>
    );
}
