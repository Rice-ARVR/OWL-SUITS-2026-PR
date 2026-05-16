import { useState, useEffect, useRef, useCallback } from "react";

export interface PingRecord {
    timestamp: string;
    rssi: number;
    signal_category: "strong" | "moderate" | "weak" | "very_weak";
    rover_position: { x: number; y: number };
}

export interface NavState {
    autonomous_driving: boolean;
    rover_position: { x: number; y: number; heading: number | null } | null;
    status_message: string;
    status_level: "info" | "warning" | "critical" | "success";
    session: {
        search_area: {
            center: { x: number; y: number };
            radius_min_m: number;
            radius_max_m: number;
        } | null;
        session_id: string;
        phase: string;
        search_center: { x: number; y: number };
        current_target: {
            position: { x: number; y: number };
            description: string;
            arrival_threshold_m: number;
        } | null;
        path_history: { x: number; y: number }[];
        ping_history: PingRecord[];
        projected_path: { x: number; y: number }[];
        best_rssi: number;
        success_vector: number;
    } | null;
    lidar_scan: {
        readings: { index: number; distance_cm: number; is_obstacle: boolean }[];
        clear_ahead: boolean;
        closest_obstacle_distance: number;
    } | null;
}

const API_BASE = "";

export function useNavigationState(enabled: boolean = false) {
    const [navState, setNavState] = useState<NavState | null>(null);
    const [connected, setConnected] = useState(false);
    const sourceRef = useRef<EventSource | null>(null);
    const retryRef = useRef<number>(0);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const connect = () => {
            if (cancelled) return;
            if (!enabled) {
                setConnected(false);
                return;
            }

            const source = new EventSource(`${API_BASE}/navigation/stream`);
            sourceRef.current = source;

            source.onopen = () => {
                retryRef.current = 0;
                setConnected(true);
            };

            source.onmessage = (event) => {
                try {
                    setNavState(JSON.parse(event.data));
                    console.log(JSON.parse(event.data));
                } catch {
                    // malformed event
                }
            };

            source.onerror = () => {
                source.close();
                setConnected(false);
                if (!cancelled) {
                    // Exponential backoff: 2s, 4s, 8s, max 30s
                    const delay = Math.min(2000 * Math.pow(2, retryRef.current), 30000);
                    retryRef.current++;
                    timeoutId = setTimeout(connect, delay);
                }
            };
        };

        connect();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
            sourceRef.current?.close();
            setNavState(null);
            setConnected(false);
        };
    }, [enabled]);

    const startAutonomy = useCallback(async (forceReset = false) => {
        const res = await fetch(`${API_BASE}/navigation/autonomy/start?force_reset=${forceReset}`, {
            method: "POST",
        });
        return res.json();
    }, []);

    const stopAutonomy = useCallback(async () => {
        const res = await fetch(`${API_BASE}/navigation/autonomy/stop`, {
            method: "POST",
        });
        return res.json();
    }, []);

    const executePing = useCallback(async () => {
        const res = await fetch(`${API_BASE}/navigation/ping/execute`, {
            method: "POST",
        });
        return res.json();
    }, []);

    return { navState, connected, startAutonomy, stopAutonomy, executePing };
}
