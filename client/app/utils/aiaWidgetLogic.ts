import type { AIAWidgetData } from "~/types/aiaWidgets";

type TelemetryData = {
    heartRate?: number;
    cabinTemperature?: number;
    oxygen?: number;
};

export function getWidgetsFromPrompt(
    prompt: string,
    telemetry: TelemetryData = {},
): AIAWidgetData[] {
    const lowerPrompt = prompt.toLowerCase();
    const widgets: AIAWidgetData[] = [];

    if (lowerPrompt.includes("heart rate")) {
        widgets.push({
            type: "telemetry",
            id: crypto.randomUUID(),
            name: "Heart Rate",
            value: telemetry.heartRate ?? "Unknown",
            unit: telemetry.heartRate ? "bpm" : undefined,
            trend: "stable",
            status: telemetry.heartRate && telemetry.heartRate > 120 ? "warning" : "normal",
            message:
                telemetry.heartRate && telemetry.heartRate > 120
                    ? "Heart rate is elevated."
                    : "Heart rate is within expected range.",
        });
    }

    if (lowerPrompt.includes("cabin temperature") || lowerPrompt.includes("temperature")) {
        widgets.push({
            type: "telemetry",
            id: crypto.randomUUID(),
            name: "Cabin Temperature",
            value: telemetry.cabinTemperature ?? "Unknown",
            unit: telemetry.cabinTemperature ? "°C" : undefined,
            trend: "stable",
            status:
                telemetry.cabinTemperature && telemetry.cabinTemperature < 18
                    ? "warning"
                    : "normal",
            message:
                telemetry.cabinTemperature && telemetry.cabinTemperature < 18
                    ? "Cabin temperature is below comfort range."
                    : "Cabin temperature is acceptable.",
        });

        if (telemetry.cabinTemperature && telemetry.cabinTemperature < 18) {
            widgets.push({
                type: "system_action",
                id: crypto.randomUUID(),
                title: "Cabin Temperature Low",
                description: "Turn on fan heating?",
                actionLabel: "Turn on heating",
                confirmText: "Yes",
                cancelText: "No",
                payload: {
                    action: "turn_on",
                    target: "fan_heating",
                    value: true,
                },
            });
        }
    }

    return widgets;
}
