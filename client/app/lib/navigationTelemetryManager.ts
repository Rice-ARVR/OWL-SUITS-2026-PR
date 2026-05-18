/**
 * Vision-based autonomous navigation telemetry manager.
 * Connects to /ws/navigation/vision and manages UI message stream from backend.
 */

export type NavigationConnectionStatus = "connecting" | "connected" | "disconnected";

export interface NavigationUIMessages {
    mode: string; // e.g., "🟢 Mode: CLEAR (Direct Pathing)"
    threat: string; // e.g., "Path: Clear"
    steering: string; // e.g., "Steering: -0.65 (Evasion: -0.80 | Goal: +0.20)"
    throttle: string; // e.g., "Throttle: SLOW (30%)"
    health: string; // e.g., "Status: Nominal"
}

type Subscriber = () => void;

class NavigationTelemetryManager {
    private static instance: NavigationTelemetryManager;

    private messages: NavigationUIMessages | null = null;
    private status: NavigationConnectionStatus = "disconnected";
    private ws: WebSocket | null = null;
    private subscribers: Set<Subscriber> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 500;
    private readonly maxReconnectDelay = 30_000;
    private shouldReconnect = false;

    private constructor() {}

    static getInstance(): NavigationTelemetryManager {
        if (!NavigationTelemetryManager.instance) {
            NavigationTelemetryManager.instance = new NavigationTelemetryManager();
        }
        return NavigationTelemetryManager.instance;
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
        const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/navigation/vision";

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
                const payload = JSON.parse(event.data as string);
                if (payload.type === "vision_navigation" && payload.data) {
                    this.messages = payload.data as NavigationUIMessages;
                    this.notify();
                }
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

    // --- Accessors ---

    getConnectionStatus(): NavigationConnectionStatus {
        return this.status;
    }

    isReady(): boolean {
        return this.messages !== null;
    }

    getMessages(): NavigationUIMessages | null {
        return this.messages;
    }

    getMode(): string {
        return this.messages?.mode ?? "";
    }

    getThreat(): string {
        return this.messages?.threat ?? "";
    }

    getSteering(): string {
        return this.messages?.steering ?? "";
    }

    getThrottle(): string {
        return this.messages?.throttle ?? "";
    }

    getHealth(): string {
        return this.messages?.health ?? "";
    }
}

export const navigationTelemetryManager = NavigationTelemetryManager.getInstance();
