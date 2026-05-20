import { useEffect, useRef, useState } from "react";
import { IconArrowUpDashed, IconArrowDownDashed } from "@tabler/icons-react";

export type Trend = "up" | "down" | "stable";

export function useTrend(value: number | null): Trend {
    const prev = useRef<number | null>(null);
    const [trend, setTrend] = useState<Trend>("stable");
    useEffect(() => {
        if (value !== null && prev.current !== null) {
            if (value > prev.current) setTrend("up");
            else if (value < prev.current) setTrend("down");
            else setTrend("stable");
        }
        prev.current = value;
    }, [value]);
    return trend;
}

export function TrendArrow({ direction, size = 20 }: { direction: Trend; size?: number }) {
    if (direction === "stable") return null;
    const Icon = direction === "up" ? IconArrowUpDashed : IconArrowDownDashed;
    const color = direction === "up" ? "#9de4ce" : "#f59095";
    return <Icon size={size} color={color} style={{ flexShrink: 0 }} />;
}
