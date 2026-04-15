import { useState, useEffect } from "react";

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Positions {
  rover: Position | null;
  eva: Position[];
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function usePositions() {
  const [positions, setPositions] = useState<Positions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const [roverRes, evaRes] = await Promise.all([
          fetch(`${API_URL}/locations/rover`),
          fetch(`${API_URL}/locations/eva`),
        ]);

        if (!roverRes.ok || !evaRes.ok) {
          throw new Error("Failed to fetch positions");
        }

        const roverData = await roverRes.json();
        const evaData = await evaRes.json();

        setPositions({
          rover: { x: roverData.x, y: roverData.y, z: roverData.z },
          eva: [evaData.eva1, evaData.eva2],
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
