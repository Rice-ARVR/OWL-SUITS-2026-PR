import React from "react";
import ReactMarkdown from "react-markdown";
import type { Message } from "~/hooks/useOllama";
import type { SystemActionWidgetData } from "~/types/aiaWidgets";

import AIAWidgetRenderer from "../widgets/AIAWidgetRenderer";
import styles from "../aia.module.css";

type Props = {
    msg: Message;
    index: number;
    fallbackContent?: React.ReactNode;
    dismissedActionIds: Set<string>;
    onSystemAction: (payload: SystemActionWidgetData["payload"], widget: SystemActionWidgetData) => void;
};

export default function MessageBubble({ msg, index, dismissedActionIds, fallbackContent, onSystemAction }: Props) {
    if (msg.hidden) return null;

    return (
        <div key={index} className={`${styles.messageBubbleWrapper} ${styles[msg.role]}`}>
            <div className={`${styles.messageBubble} ${styles[msg.role]}`}>
                {msg.role === "assistant" ? (
                    <div className={styles.markdown}>
                        <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                    </div>
                ) : (
                    msg.content || fallbackContent
                )}
            </div>

            {(() => {
                const visible = [...(msg.widgets ?? [])].filter(
                    (widget) => !dismissedActionIds.has(widget.id),
                );
                const telemetry = visible.filter((w) => w.type === "telemetry");
                const others = visible.filter((w) => w.type !== "telemetry");

                return (
                    <>
                        {telemetry.length > 0 && (
                            <div className={styles.telemetryWidgetGrid}>
                                {telemetry.map((widget) => (
                                    <AIAWidgetRenderer
                                        key={widget.id}
                                        widget={widget}
                                        onSystemAction={onSystemAction}
                                    />
                                ))}
                            </div>
                        )}
                        {others.map((widget) => (
                            <AIAWidgetRenderer
                                key={widget.id}
                                widget={widget}
                                onSystemAction={onSystemAction}
                            />
                        ))}
                    </>
                );
            })()}
        </div>
    );
}
