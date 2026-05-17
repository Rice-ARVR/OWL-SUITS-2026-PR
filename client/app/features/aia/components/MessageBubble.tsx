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

            {[...( msg.widgets ?? [])]
                .filter((widget) => !dismissedActionIds.has(widget.id))
                .sort((a, b) => (a.type === "system_action" ? 1 : 0) - (b.type === "system_action" ? 1 : 0))
                .map((widget) => (
                    <AIAWidgetRenderer
                        key={widget.id}
                        widget={widget}
                        onSystemAction={onSystemAction}
                    />
                ))}
        </div>
    );
}
