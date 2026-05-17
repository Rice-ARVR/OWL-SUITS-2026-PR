import type { SystemActionWidgetData } from "../../../types/aiaWidgets";
import styles from "../aia.module.css";

type Props = {
    widget: SystemActionWidgetData;
    onAction: (payload: SystemActionWidgetData["payload"], widget: SystemActionWidgetData) => void;
};

export default function SystemActionWidget({ widget, onAction }: Props) {
    return (
        <div className={`${styles.aiaWidget} ${styles.actionModalWidget}`}>
            <div className={styles.aiaWidgetHeader}>
                <span className={styles.aiaWidgetTitle}>{widget.title}</span>
            </div>

            <p className={styles.aiaWidgetDescription}>{widget.description}</p>

            <div className={styles.aiaWidgetActions}>
                <button onClick={() => onAction(widget.payload, widget)}>
                    {widget.confirmText ?? "Yes"}
                </button>

                <button
                    className={styles.secondaryButton}
                    onClick={() =>
                        onAction({ action: "cancel", target: widget.payload.target }, widget)
                    }
                >
                    {widget.cancelText ?? "No"}
                </button>
            </div>
        </div>
    );
}
