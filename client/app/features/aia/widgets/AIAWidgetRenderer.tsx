import type { AIAWidgetData, SystemActionWidgetData } from "../../../types/aiaWidgets";

import TelemetryWidget from "./TelemetryWidget";
import SystemActionWidget from "./SystemActionWidget";

type Props = {
    widget: AIAWidgetData;
    onSystemAction: (payload: SystemActionWidgetData["payload"], widget: SystemActionWidgetData) => void;
};

export default function AIAWidgetRenderer({ widget, onSystemAction }: Props) {
    if (widget.type === "telemetry") {
        return <TelemetryWidget widget={widget} />;
    }

    if (widget.type === "system_action") {
        return <SystemActionWidget widget={widget} onAction={onSystemAction} />;
    }

    return null;
}
