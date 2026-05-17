import type {
    ErrorProcedure,
    EvaSnapshot,
    ImuUnit,
    LtvSnapshot,
    RoverSnapshot,
    TelemetrySnapshot,
} from "~/types/telemetry";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type Subscriber = () => void;

class TelemetryManager {
    private static instance: TelemetryManager;

    private data: TelemetrySnapshot | null = null;
    private status: ConnectionStatus = "disconnected";
    private ws: WebSocket | null = null;
    private subscribers: Set<Subscriber> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 500;
    private readonly maxReconnectDelay = 30_000;
    private shouldReconnect = false;

    private constructor() {}

    static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }

    // --- Lifecycle ---

    connect(): void {
        if (
            this.ws?.readyState === WebSocket.OPEN ||
            this.ws?.readyState === WebSocket.CONNECTING
        ) {
            return;
        }
        this.shouldReconnect = true;
        this.openConnection();
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
    }

    private openConnection(): void {
        const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
        const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/telemetry";

        this.status = "connecting";
        this.notify();

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
            this.reconnectDelay = 500;
            this.status = "connected";
            this.notify();
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                this.data = JSON.parse(event.data as string) as TelemetrySnapshot;
                this.notify();
            } catch {
                // ignore malformed message
            }
        };

        ws.onclose = () => {
            this.status = "disconnected";
            this.notify();
            if (this.shouldReconnect) {
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
                    this.openConnection();
                }, this.reconnectDelay);
            }
        };

        // onerror always precedes onclose; let onclose handle the reconnect
        ws.onerror = () => {};
    }

    // --- Subscription ---

    subscribe(callback: Subscriber): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notify(): void {
        this.subscribers.forEach((cb) => cb());
    }

    // --- Meta ---

    getConnectionStatus(): ConnectionStatus {
        return this.status;
    }

    isReady(): boolean {
        return this.data !== null;
    }

    getSnapshot(): TelemetrySnapshot | null {
        return this.data;
    }

    // --- EVA 1 telemetry ---

    getEva1PrimaryBatteryLevel(): number | null {
        return this.data?.eva.telemetry.eva1.primary_battery_level ?? null;
    }

    getEva1SecondaryBatteryLevel(): number | null {
        return this.data?.eva.telemetry.eva1.secondary_battery_level ?? null;
    }

    getEva1OxyPriStorage(): number | null {
        return this.data?.eva.telemetry.eva1.oxy_pri_storage ?? null;
    }

    getEva1OxySecStorage(): number | null {
        return this.data?.eva.telemetry.eva1.oxy_sec_storage ?? null;
    }

    getEva1OxyPriPressure(): number | null {
        return this.data?.eva.telemetry.eva1.oxy_pri_pressure ?? null;
    }

    getEva1OxySecPressure(): number | null {
        return this.data?.eva.telemetry.eva1.oxy_sec_pressure ?? null;
    }

    getEva1SuitPressureOxy(): number | null {
        return this.data?.eva.telemetry.eva1.suit_pressure_oxy ?? null;
    }

    getEva1SuitPressureCo2(): number | null {
        return this.data?.eva.telemetry.eva1.suit_pressure_co2 ?? null;
    }

    getEva1SuitPressureOther(): number | null {
        return this.data?.eva.telemetry.eva1.suit_pressure_other ?? null;
    }

    getEva1SuitPressureTotal(): number | null {
        return this.data?.eva.telemetry.eva1.suit_pressure_total ?? null;
    }

    getEva1HelmetPressureCo2(): number | null {
        return this.data?.eva.telemetry.eva1.helmet_pressure_co2 ?? null;
    }

    getEva1FanPriRpm(): number | null {
        return this.data?.eva.telemetry.eva1.fan_pri_rpm ?? null;
    }

    getEva1FanSecRpm(): number | null {
        return this.data?.eva.telemetry.eva1.fan_sec_rpm ?? null;
    }

    getEva1ScrubberACo2Storage(): number | null {
        return this.data?.eva.telemetry.eva1.scrubber_a_co2_storage ?? null;
    }

    getEva1ScrubberBCo2Storage(): number | null {
        return this.data?.eva.telemetry.eva1.scrubber_b_co2_storage ?? null;
    }

    getEva1Temperature(): number | null {
        return this.data?.eva.telemetry.eva1.temperature ?? null;
    }

    getEva1CoolantStorage(): number | null {
        return this.data?.eva.telemetry.eva1.coolant_storage ?? null;
    }

    getEva1CoolantGasPressure(): number | null {
        return this.data?.eva.telemetry.eva1.coolant_gas_pressure ?? null;
    }

    getEva1CoolantLiquidPressure(): number | null {
        return this.data?.eva.telemetry.eva1.coolant_liquid_pressure ?? null;
    }

    getEva1HeartRate(): number | null {
        return this.data?.eva.telemetry.eva1.heart_rate ?? null;
    }

    getEva1OxyConsumption(): number | null {
        return this.data?.eva.telemetry.eva1.oxy_consumption ?? null;
    }

    getEva1Co2Production(): number | null {
        return this.data?.eva.telemetry.eva1.co2_production ?? null;
    }

    getEva1ElapsedTime(): number | null {
        return this.data?.eva.telemetry.eva1.eva_elapsed_time ?? null;
    }

    // --- EVA 2 telemetry ---

    getEva2BatteryLevel(): number | null {
        return this.data?.eva.telemetry.eva2.battery_level ?? null;
    }

    getEva2OxyPriStorage(): number | null {
        return this.data?.eva.telemetry.eva2.oxy_pri_storage ?? null;
    }

    getEva2OxySecStorage(): number | null {
        return this.data?.eva.telemetry.eva2.oxy_sec_storage ?? null;
    }

    getEva2OxyPriPressure(): number | null {
        return this.data?.eva.telemetry.eva2.oxy_pri_pressure ?? null;
    }

    getEva2OxySecPressure(): number | null {
        return this.data?.eva.telemetry.eva2.oxy_sec_pressure ?? null;
    }

    getEva2SuitPressureOxy(): number | null {
        return this.data?.eva.telemetry.eva2.suit_pressure_oxy ?? null;
    }

    getEva2SuitPressureCo2(): number | null {
        return this.data?.eva.telemetry.eva2.suit_pressure_co2 ?? null;
    }

    getEva2SuitPressureOther(): number | null {
        return this.data?.eva.telemetry.eva2.suit_pressure_other ?? null;
    }

    getEva2SuitPressureTotal(): number | null {
        return this.data?.eva.telemetry.eva2.suit_pressure_total ?? null;
    }

    getEva2HelmetPressureCo2(): number | null {
        return this.data?.eva.telemetry.eva2.helmet_pressure_co2 ?? null;
    }

    getEva2FanPriRpm(): number | null {
        return this.data?.eva.telemetry.eva2.fan_pri_rpm ?? null;
    }

    getEva2FanSecRpm(): number | null {
        return this.data?.eva.telemetry.eva2.fan_sec_rpm ?? null;
    }

    getEva2ScrubberACo2Storage(): number | null {
        return this.data?.eva.telemetry.eva2.scrubber_a_co2_storage ?? null;
    }

    getEva2ScrubberBCo2Storage(): number | null {
        return this.data?.eva.telemetry.eva2.scrubber_b_co2_storage ?? null;
    }

    getEva2Temperature(): number | null {
        return this.data?.eva.telemetry.eva2.temperature ?? null;
    }

    getEva2CoolantStorage(): number | null {
        return this.data?.eva.telemetry.eva2.coolant_storage ?? null;
    }

    getEva2CoolantGasPressure(): number | null {
        return this.data?.eva.telemetry.eva2.coolant_gas_pressure ?? null;
    }

    getEva2CoolantLiquidPressure(): number | null {
        return this.data?.eva.telemetry.eva2.coolant_liquid_pressure ?? null;
    }

    getEva2HeartRate(): number | null {
        return this.data?.eva.telemetry.eva2.heart_rate ?? null;
    }

    getEva2OxyConsumption(): number | null {
        return this.data?.eva.telemetry.eva2.oxy_consumption ?? null;
    }

    getEva2Co2Production(): number | null {
        return this.data?.eva.telemetry.eva2.co2_production ?? null;
    }

    getEva2ElapsedTime(): number | null {
        return this.data?.eva.telemetry.eva2.eva_elapsed_time ?? null;
    }

    // --- EVA status / DCU / error / IMU / UIA ---

    getEvaStarted(): boolean | null {
        return this.data?.eva.status.started ?? null;
    }

    getEvaSnapshot(): EvaSnapshot | null {
        return this.data?.eva ?? null;
    }

    getEvaImu(unit: "eva1" | "eva2"): ImuUnit | null {
        return this.data?.eva.imu[unit] ?? null;
    }

    // --- Rover ---

    getRoverSnapshot(): RoverSnapshot | null {
        return this.data?.rover ?? null;
    }

    getRoverSpeed(): number | null {
        return this.data?.rover.pr_telemetry.speed ?? null;
    }

    getRoverBatteryLevel(): number | null {
        return this.data?.rover.pr_telemetry.battery_level ?? null;
    }

    getRoverPrimaryBatteryLevel(): number | null {
        return this.data?.rover.pr_telemetry.primary_battery_level ?? null;
    }

    getRoverSecondaryBatteryLevel(): number | null {
        return this.data?.rover.pr_telemetry.secondary_battery_level ?? null;
    }

    getRoverHeading(): number | null {
        return this.data?.rover.pr_telemetry.heading ?? null;
    }

    getRoverPitch(): number | null {
        return this.data?.rover.pr_telemetry.pitch ?? null;
    }

    getRoverRoll(): number | null {
        return this.data?.rover.pr_telemetry.roll ?? null;
    }

    getRoverPosition(): { x: number; y: number; z: number } | null {
        const pr = this.data?.rover.pr_telemetry;
        if (!pr) return null;
        return { x: pr.rover_pos_x, y: pr.rover_pos_y, z: pr.rover_pos_z };
    }

    getRoverDistanceTraveled(): number | null {
        return this.data?.rover.pr_telemetry.distance_traveled ?? null;
    }

    getRoverDistanceFromBase(): number | null {
        return this.data?.rover.pr_telemetry.distance_from_base ?? null;
    }

    getRoverCabinPressure(): number | null {
        return this.data?.rover.pr_telemetry.cabin_pressure ?? null;
    }

    getRoverCabinTemperature(): number | null {
        return this.data?.rover.pr_telemetry.cabin_temperature ?? null;
    }

    getRoverExternalTemp(): number | null {
        return this.data?.rover.pr_telemetry.external_temp ?? null;
    }

    getRoverOxygenStorage(): number | null {
        return this.data?.rover.pr_telemetry.oxygen_storage ?? null;
    }

    getRoverOxygenPressure(): number | null {
        return this.data?.rover.pr_telemetry.oxygen_pressure ?? null;
    }

    getRoverCoolantPressure(): number | null {
        return this.data?.rover.pr_telemetry.coolant_pressure ?? null;
    }

    getRoverCoolantStorage(): number | null {
        return this.data?.rover.pr_telemetry.coolant_storage ?? null;
    }

    getRoverThrottle(): number | null {
        return this.data?.rover.pr_telemetry.throttle ?? null;
    }

    getRoverSteering(): number | null {
        return this.data?.rover.pr_telemetry.steering ?? null;
    }

    getRoverBrakes(): boolean | null {
        return this.data?.rover.pr_telemetry.brakes ?? null;
    }

    getRoverLidar(): number[] | null {
        return this.data?.rover.pr_telemetry.lidar ?? null;
    }

    getRoverElapsedTime(): number | null {
        return this.data?.rover.pr_telemetry.rover_elapsed_time ?? null;
    }

    getRoverSimRunning(): boolean | null {
        return this.data?.rover.pr_telemetry.sim_running ?? null;
    }

    getRoverSurfaceIncline(): number | null {
        return this.data?.rover.pr_telemetry.surface_incline ?? null;
    }

    getRoverLightsOn(): boolean | null {
        return this.data?.rover.pr_telemetry.lights_on ?? null;
    }

    // --- LTV ---

    getLtvSnapshot(): LtvSnapshot | null {
        return this.data?.ltv ?? null;
    }

    getLtvSignalStrength(): number | null {
        return this.data?.ltv.signal.strength ?? null;
    }

    getLtvLocation(): { x: number; y: number } | null {
        const loc = this.data?.ltv.location;
        if (!loc) return null;
        return { x: loc.last_known_x, y: loc.last_known_y };
    }

    getLtvPingRequested(): number | null {
        return this.data?.ltv.signal.ping_requested ?? null;
    }

    // --- LTV Errors ---

    getLtvErrorProcedures(): ErrorProcedure[] | null {
        return this.data?.ltv_errors.error_procedures ?? null;
    }

    getLtvErrorByCode(code: string): ErrorProcedure | null {
        return this.data?.ltv_errors.error_procedures.find((e) => e.code === code) ?? null;
    }
}

export const telemetryManager = TelemetryManager.getInstance();
