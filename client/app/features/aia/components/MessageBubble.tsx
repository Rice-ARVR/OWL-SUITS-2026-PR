import React from "react";
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
            <span className={`${styles.messageBubble} ${styles[msg.role]}`}>
                {msg.content || fallbackContent}
            </span>

            {msg.widgets
                ?.filter((widget) => !dismissedActionIds.has(widget.id))
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
