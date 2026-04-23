import { useEffect, useRef } from "react";

type Trend = "up" | "down" | "stable";

function useTrend(value: number | null): Trend {
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

interface MetricProps {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  safeMin?: number;
  safeMax?: number;
  trend?: "up" | "down" | "stable";
}

const TICKS = [0, 1 / 5, 2 / 5, 3 / 5, 4 / 5, 1];

function TrendArrow({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "stable") return null;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: direction === "down" ? "rotate(180deg)" : "none" }}
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

function Metric({
  label,
  value,
  unit,
  min,
  max,
  safeMin,
  safeMax,
  trend = "up",
}: MetricProps) {
  const inRange =
    value !== null &&
    safeMin !== undefined &&
    safeMax !== undefined &&
    value >= safeMin &&
    value <= safeMax;
  const statusLabel = value === null ? "Normal" : inRange ? "Normal" : "Critical";
  const statusColor = value === null || inRange ? "#9DE4CE" : "#F59095";

  const pct =
    value !== null ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const safeMinPct = Math.min(
    1,
    Math.max(0, ((safeMin ?? min + (max - min) * 0.25) - min) / (max - min)),
  );
  const safeMaxPct = Math.min(
    1,
    Math.max(0, ((safeMax ?? min + (max - min) * 0.75) - min) / (max - min)),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      {/* Status + label */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            color: "#c5c9d2",
          }}
        >
          {label}
        </span>
      </div>

      {/* Value + trend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 32,
            fontWeight: 500,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          {value !== null ? value.toFixed(0) : "--"}
        </span>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 14,
            color: "#c5c9d2",
          }}
        >
          {unit}
        </span>
        <TrendArrow direction={trend} />
      </div>

      {/* Horizontal bar with ticks and indicator */}
      <div
        style={{
          position: "relative",
          height: 24,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Track */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 10,
            background: "#4a4a52",
            borderRadius: 99,
          }}
        />

        {/* Safe zone */}
        <div
          style={{
            position: "absolute",
            left: `${safeMinPct * 100}%`,
            width: `${(safeMaxPct - safeMinPct) * 100}%`,
            height: 10,
            background: "rgba(255,255,255,0.3)",
            borderRadius: 99,
          }}
        />

        {/* Ticks */}
        {TICKS.map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              width: 2,
              height: 10,
              background: "#6b7280",
              borderRadius: 1,
              transform: "translateX(-50%)",
            }}
          />
        ))}

        {/* Indicator circle */}
        <div
          style={{
            position: "absolute",
            left: `${pct * 100}%`,
            transform: "translateX(-50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 4px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    </div>
  );
}

interface HealthProps {
  bodyTemp: number | null;
  heartRate: number | null;
}

export default function Health({ bodyTemp, heartRate }: HealthProps) {
  const bodyTempTrend = useTrend(bodyTemp);
  const heartRateTrend = useTrend(heartRate);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <Metric
        label="Body Temp"
        value={bodyTemp}
        unit="°"
        min={15}
        max={35}
        safeMin={20}
        safeMax={30}
        trend={bodyTempTrend}
      />
      <div
        style={{
          width: 1,
          background: "rgba(255,255,255,0.08)",
          alignSelf: "stretch",
        }}
      />
      <Metric
        label="Heart Rate"
        value={heartRate}
        unit="bpm"
        min={40}
        max={180}
        safeMin={60}
        safeMax={120}
        trend={heartRateTrend}
      />
    </div>
  );
}
