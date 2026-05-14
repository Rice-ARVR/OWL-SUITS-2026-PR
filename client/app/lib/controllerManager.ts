import type { RoverControlPayload } from "~/types/roverControl";

export type { RoverControlPayload };
export type ControllerConnectionStatus = "connecting" | "connected" | "disconnected";

class ControllerManager {
    private static instance: ControllerManager;

    private status: ControllerConnectionStatus = "disconnected";
    private ws: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 500;
    private readonly maxReconnectDelay = 30_000;
    private shouldReconnect = false;
    private initialSyncPayload: RoverControlPayload | null = null;
    private initialSyncSent = false;

    private constructor() {}

    static getInstance(): ControllerManager {
        if (!ControllerManager.instance) {
            ControllerManager.instance = new ControllerManager();
        }
        return ControllerManager.instance;
    }

    // --- Setup ---

    // Call once on app startup to push a known initial state to TSS on first connection.
    registerInitialSync(payload: RoverControlPayload): void {
        this.initialSyncPayload = payload;
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
        const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/rover/control";

        this.status = "connecting";

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
            this.reconnectDelay = 500;
            this.status = "connected";
            if (!this.initialSyncSent && this.initialSyncPayload) {
                this.sendCommand(this.initialSyncPayload);
                this.initialSyncSent = true;
            }
        };

        ws.onclose = () => {
            this.status = "disconnected";
            if (this.shouldReconnect) {
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectDelay = Math.min(
                        this.reconnectDelay * 2,
                        this.maxReconnectDelay,
                    );
                    this.openConnection();
                }, this.reconnectDelay);
            }
        };

        // onerror always precedes onclose; let onclose handle the reconnect
        ws.onerror = () => {};
    }

    // --- Commands ---

    sendCommand(payload: RoverControlPayload): void {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify(payload));
    }

    // --- Meta ---

    getConnectionStatus(): ControllerConnectionStatus {
        return this.status;
    }

    isConnected(): boolean {
        return this.status === "connected";
    }
}

export const controllerManager = ControllerManager.getInstance();
