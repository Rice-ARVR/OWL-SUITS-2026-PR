export type TelemetryStatus = "normal" | "warning" | "critical" | "unknown";
export type TelemetryTrend = "up" | "down" | "stable" | "unknown";

export type TelemetryWidgetData = {
    type: "telemetry";
    id: string;
    name: string;
    telemetryKey?: string;
    value: string | number;
    unit?: string;
    trend?: TelemetryTrend;
    status?: TelemetryStatus;
    message?: string;
};

export type SystemActionWidgetData = {
    type: "system_action";
    id: string;
    title: string;
    description: string;
    actionLabel: string;
    confirmText?: string;
    cancelText?: string;
    payload: {
        action: string;
        target?: string;
        value?: string | number | boolean;
    };
};

export type AIAWidgetData = TelemetryWidgetData | SystemActionWidgetData;
