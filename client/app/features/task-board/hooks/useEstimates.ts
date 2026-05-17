import { useEffect, useState } from "react";

interface Estimates {
    rover_battery_time_remaining_s: number | null;
    rover_oxygen_time_remaining_s: number | null;
    eva_battery_time_remaining_s: number | null;
    eva_oxygen_time_remaining_s: number | null;
}

const DEFAULT: Estimates = {
    rover_battery_time_remaining_s: null,
    rover_oxygen_time_remaining_s: null,
    eva_battery_time_remaining_s: null,
    eva_oxygen_time_remaining_s: null,
};

export function useEstimates(): Estimates {
    const [estimates, setEstimates] = useState<Estimates>(DEFAULT);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
        let active = true;

        const fetchEstimates = () => {
            fetch(`${apiUrl}/estimation/time_remaining`)
                .then((res) => res.json() as Promise<Estimates>)
                .then((data) => {
                    if (active) setEstimates(data);
                })
                .catch(() => {});
        };

        fetchEstimates();
        const interval = setInterval(fetchEstimates, 1000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    return estimates;
}
