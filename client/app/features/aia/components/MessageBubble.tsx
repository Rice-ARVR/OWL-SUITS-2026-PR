import React from "react";
import type { Message } from "~/hooks/useOllama";
import type { SystemActionWidgetData } from "~/types/aiaWidgets";

import AIAWidgetRenderer from "../widgets/AIAWidgetRenderer";
import styles from "../aia.module.css";

type Props = {
    msg: Message;
    index: number;
    fallbackContent?: React.ReactNode;
    onSystemAction: (payload: SystemActionWidgetData["payload"]) => void;
};

export default function MessageBubble({ msg, index, fallbackContent, onSystemAction }: Props) {
    return (
        <div key={index} className={`${styles.messageBubbleWrapper} ${styles[msg.role]}`}>
            <span className={`${styles.messageBubble} ${styles[msg.role]}`}>
                {msg.content || fallbackContent}
            </span>

            {msg.widgets
                ?.filter((widget) => widget.type === "telemetry")
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
