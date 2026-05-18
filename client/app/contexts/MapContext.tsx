import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import type { MapPoint, Hazard } from "~/types/map";
import { useNavigationState } from "~/features/map/interactive-map/useNavigationState";
import type { NavState } from "~/features/map/interactive-map/useNavigationState";

export interface SavedPingRecord {
    timestamp?: string;
    rover_position: { x: number; y: number };
    rssi: number;
    signal_category: string;
}

export interface SavedSearchArea {
    center: { x: number; y: number };
    radius_min_m: number;
    radius_max_m: number;
}

// ── Cross-window state sync via BroadcastChannel ──────────────────────────────
// Each route (map, screen) opens in its own browser window. BroadcastChannel
// syncs state across same-origin windows without extra backend calls.
//
// Three message types handle two scenarios:
//   'update'   — a window changed state; push to all other windows
//   'request'  — a newly refreshed window asking for current state
//   'response' — any other window answering that request with its current state

type Msg<T> =
    | { type: "update"; data: T }
    | { type: "request" }
    | { type: "response"; data: T };

function useBroadcastState<T>(
    channelName: string,
    initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setStateLocal] = useState<T>(initialValue);
    const channelRef = useRef<BroadcastChannel | null>(null);
    // Always holds the latest value so the onmessage handler can respond to requests
    // without capturing a stale closure.
    const stateRef = useRef<T>(initialValue);
    stateRef.current = state;

    useEffect(() => {
        const ch = new BroadcastChannel(`suits-map:${channelName}`);
        channelRef.current = ch;

        ch.onmessage = (event: MessageEvent<Msg<T>>) => {
            if (event.data.type === "update" || event.data.type === "response") {
                setStateLocal(event.data.data);
            } else if (event.data.type === "request") {
                // Reply with our current state so the refreshed window catches up
                ch.postMessage({ type: "response", data: stateRef.current });
            }
        };

        // On mount, ask any already-open windows for their current state
        ch.postMessage({ type: "request" });

        return () => ch.close();
    }, [channelName]);

    const setState: React.Dispatch<React.SetStateAction<T>> = useCallback(
        (action) => {
            setStateLocal((prev) => {
                const next =
                    typeof action === "function"
                        ? (action as (p: T) => T)(prev)
                        : action;
                channelRef.current?.postMessage({ type: "update", data: next });
                return next;
            });
        },
        [],
    );

    return [state, setState];
}

// ─────────────────────────────────────────────────────────────────────────────

interface MapContextValue {
    points: MapPoint[];
    setPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
    hazards: Hazard[];
    setHazards: React.Dispatch<React.SetStateAction<Hazard[]>>;
    savedPingHistory: SavedPingRecord[];
    setSavedPingHistory: React.Dispatch<React.SetStateAction<SavedPingRecord[]>>;
    savedSearchArea: SavedSearchArea | null;
    setSavedSearchArea: React.Dispatch<React.SetStateAction<SavedSearchArea | null>>;
    navState: NavState | null;
    autonomyRequested: boolean;
    setAutonomyRequested: React.Dispatch<React.SetStateAction<boolean>>;
    startAutonomy: (forceReset?: boolean) => Promise<unknown>;
    stopAutonomy: () => Promise<unknown>;
    executePing: () => Promise<unknown>;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: React.ReactNode }) {
    const [points, setPoints] = useBroadcastState<MapPoint[]>("points", []);
    const [hazards, setHazards] = useBroadcastState<Hazard[]>("hazards", []);
    const [savedPingHistory, setSavedPingHistory] = useBroadcastState<SavedPingRecord[]>(
        "ping-history",
        [],
    );
    const [savedSearchArea, setSavedSearchArea] =
        useBroadcastState<SavedSearchArea | null>("search-area", null);
    const [autonomyRequested, setAutonomyRequested] = useBroadcastState<boolean>(
        "autonomy-requested",
        false,
    );

    const { navState, startAutonomy, stopAutonomy, executePing } =
        useNavigationState(autonomyRequested);

    useEffect(() => {
        if (navState?.session?.ping_history && navState.session.ping_history.length > 0) {
            setSavedPingHistory(navState.session.ping_history);
        }
    }, [navState?.session?.ping_history]);

    useEffect(() => {
        if (navState?.session?.search_area) {
            setSavedSearchArea(navState.session.search_area);
        }
    }, [navState?.session?.search_area]);

    return (
        <MapContext.Provider
            value={{
                points,
                setPoints,
                hazards,
                setHazards,
                savedPingHistory,
                setSavedPingHistory,
                savedSearchArea,
                setSavedSearchArea,
                navState,
                autonomyRequested,
                setAutonomyRequested,
                startAutonomy,
                stopAutonomy,
                executePing,
            }}
        >
            {children}
        </MapContext.Provider>
    );
}

export function useMapContext() {
    const ctx = useContext(MapContext);
    if (!ctx) throw new Error("useMapContext must be used within MapProvider");
    return ctx;
}
