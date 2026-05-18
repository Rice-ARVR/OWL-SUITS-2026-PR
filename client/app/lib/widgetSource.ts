export function getSourceFromKey(key: string | undefined): string | null {
    if (!key) return null;
    if (key.toLowerCase().includes("eva1")) return "EVA 1";
    if (key.toLowerCase().includes("eva2")) return "EVA 2";
    if (key.toLowerCase().includes("rover") || key.toLowerCase().startsWith("pr_telemetry")) return "Rover";
    return null;
}
