import { useEffect, useRef } from "react";

export type Trend = "up" | "down" | "stable";

export function useTrend(value: number | null): Trend {
    const prev = useRef<number | null>(null);
    const trend = useRef<Trend>("stable");
    useEffect(() => {
        if (value !== null && prev.current !== null) {
            if (value > prev.current) trend.current = "up";
            else if (value < prev.current) trend.current = "down";
            else trend.current = "stable";
        }
        prev.current = value;
    }, [value]);
    return trend.current;
}

export function TrendArrow({ direction, size = 16 }: { direction: Trend; size?: number }) {
    if (direction === "stable") return null;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            style={{ transform: direction === "down" ? "rotate(180deg)" : "none", flexShrink: 0 }}
        >
            <path
                d="M8 12V4M8 4L4.5 7.5M8 4L11.5 7.5"
                stroke="#f87171"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
