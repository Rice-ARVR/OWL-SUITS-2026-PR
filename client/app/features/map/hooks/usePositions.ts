import { useState, useEffect } from "react";

export interface Position {
    x: number;
    y: number;
    z?: number;
}

export interface Hazard {
    type: string;
    x: number;
    y: number;
    radius?: number;
    size?: number;
}

export interface Waypoint {
    x: number;
    y: number;
    label: string;
}

export interface BestPath {
    path: Position[];
    total_distance: number;
    available_range: number;
    can_reach: boolean;
    warning: string | null;
}

export interface LtvPosition extends Position {
    signal?: {
        strength: number;
        ping_requested: number;
    };
}

export interface Positions {
    rover: Position | null;
    eva: Position[];
    ltv: LtvPosition | null;
    hazards: Hazard[];
    waypoints: Waypoint[];
    recommendedPath: Position[];
    ltvSearchRadius: number;
    bestPath: BestPath;
    roverHistory: Position[];
    evaHistory: Position[][];
    ltvHistory: Position[];
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function usePositions() {
    const [positions, setPositions] = useState<Positions | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize history
    const [roverHistory, setRoverHistory] = useState<Position[]>([]);
    const [evaHistory, setEvaHistory] = useState<Position[][]>([[], []]);
    const [ltvHistory, setLtvHistory] = useState<Position[]>([]);

    useEffect(() => {
        const fetchPositions = async () => {
            try {
                const [roverRes, evaRes, ltvRes, hazardsRes, waypointsRes, pathRes, radiusRes] =
                    await Promise.all([
                        fetch(`${API_URL}/locations/rover`),
                        fetch(`${API_URL}/locations/eva`),
                        fetch(`${API_URL}/locations/ltv`),
                        fetch(`${API_URL}/locations/hazards`),
                        fetch(`${API_URL}/locations/waypoints`),
                        fetch(`${API_URL}/locations/recommended-path`),
                        fetch(`${API_URL}/locations/ltv-search-radius`),
                    ]);

                if (
                    !roverRes.ok ||
                    !evaRes.ok ||
                    !ltvRes.ok ||
                    !hazardsRes.ok ||
                    !waypointsRes.ok ||
                    !pathRes.ok ||
                    !radiusRes.ok
                ) {
                    throw new Error("Failed to fetch positions");
                }

                const roverData = await roverRes.json();
                const evaData = await evaRes.json();
                const ltvData = await ltvRes.json();
                const hazardsData = await hazardsRes.json();
                const waypointsData = await waypointsRes.json();
                const pathData = await pathRes.json();
                const radiusData = await radiusRes.json();

                // Update history
                if (roverData.x !== undefined && roverData.y !== undefined) {
                    setRoverHistory((prev) => [
                        ...prev.slice(-20),
                        { x: roverData.x, y: roverData.y },
                    ]); // Keep last 20
                }
                if (evaData.eva1) {
                    setEvaHistory((prev) => [
                        [...prev[0].slice(-20), { x: evaData.eva1.x, y: evaData.eva1.y }],
                        prev[1],
                    ]);
                }
                if (evaData.eva2) {
                    setEvaHistory((prev) => [
                        prev[0],
                        [...prev[1].slice(-20), { x: evaData.eva2.x, y: evaData.eva2.y }],
                    ]);
                }
                if (ltvData.x !== undefined && ltvData.y !== undefined) {
                    setLtvHistory((prev) => [...prev.slice(-20), { x: ltvData.x, y: ltvData.y }]);
                }

                setPositions({
                    rover: { x: roverData.x, y: roverData.y, z: roverData.z },
                    eva: [evaData.eva1, evaData.eva2],
                    ltv: { x: ltvData.x, y: ltvData.y, signal: ltvData.signal },
                    hazards: hazardsData,
                    waypoints: waypointsData,
                    recommendedPath: pathData.path,
                    ltvSearchRadius: radiusData.radius,
                    bestPath: pathData,
                    roverHistory,
                    evaHistory,
                    ltvHistory,
                });
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            }
        };

        fetchPositions();
        const interval = setInterval(fetchPositions, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, []);

    return { positions, error };
}
