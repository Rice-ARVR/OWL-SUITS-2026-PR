import { useEffect, useState } from "react";

interface GraphProps {
  value: number | null;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  safeMin?: number;
  safeMax?: number;
}

const MAX_POINTS = 20;
const W = 160;
const H = 120;
const LINE_COLOR = "#A1A4AF";
const PAD = { top: 10, right: 12, bottom: 28, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

export default function Graph({
  value,
  label,
  unit = "",
  min,
  max,
  safeMin,
  safeMax,
}: GraphProps) {
  const hasRange = safeMin !== undefined && safeMax !== undefined;
  const inRange = hasRange && value !== null && value >= safeMin! && value <= safeMax!;
  const statusLabel = !hasRange ? null : value === null || inRange ? "Normal" : "Critical";
  const statusColor = value === null || inRange ? "#9DE4CE" : "#F59095";
  const fillColor = !hasRange || value === null || inRange ? "#6F7674" : "#5C5357";

  const [history, setHistory] = useState<(number | null)[]>([]);

  useEffect(() => {
    setHistory((prev) => {
      const next = [...prev, value];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [value]);

  const values = history.filter((v): v is number => v !== null);

  const lastIdx = [...history].reverse().findIndex((v) => v !== null);
  const currentIdx = lastIdx === -1 ? -1 : history.length - 1 - lastIdx;
  const currentVal = currentIdx !== -1 ? (history[currentIdx] as number) : null;

  let yMin: number;
  let yMax: number;
  if (min !== undefined && max !== undefined) {
    const windowSize = (max - min) * 0.2;
    const latest =
      currentVal ?? (values.length ? values[values.length - 1] : min);
    const windowIndex = Math.floor((latest - min) / windowSize);
    const clampedIndex = Math.max(0, Math.min(4, windowIndex));
    yMin = min + clampedIndex * windowSize;
    yMax = yMin + windowSize;
  } else {
    yMin = min ?? (values.length ? Math.min(...values) : 0);
    yMax = max ?? (values.length ? Math.max(...values) : 1);
  }
  const yRange = yMax - yMin || 1;

  const xOf = (i: number) => PAD.left + (i / (MAX_POINTS - 1)) * plotW;

  const yOf = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * plotH;

  const baseline = yOf(yMin);

  const segments: string[] = [];
  const fills: string[] = [];
  let pathCmd = "";
  let segStartX = 0;
  let segLastX = 0;
  for (let i = 0; i < history.length; i++) {
    const v = history[i];
    if (v === null) {
      if (pathCmd) {
        segments.push(pathCmd);
        fills.push(
          `${pathCmd} L ${segLastX} ${baseline} L ${segStartX} ${baseline} Z`,
        );
      }
      pathCmd = "";
      continue;
    }
    const x = xOf(i);
    const y = yOf(v);
    if (pathCmd === "") {
      pathCmd = `M ${x} ${y}`;
      segStartX = x;
    } else {
      pathCmd += ` L ${x} ${y}`;
    }
    segLastX = x;
  }
  if (pathCmd) {
    segments.push(pathCmd);
    fills.push(
      `${pathCmd} L ${segLastX} ${baseline} L ${segStartX} ${baseline} Z`,
    );
  }

  const yTicks = [yMax, (yMax + yMin) / 2, yMin];
  const xTicks = [20, 15, 10, 5, 0];

  return (
    <div
      style={{
        background: "#2E2E32",
        borderRadius: 12,
        padding: "16px 12px 12px",
        width: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}
    >
      <svg width={W} height={H} style={{ overflow: "visible", flexShrink: 0 }}>
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={yOf(tick)}
            x2={W - PAD.right}
            y2={yOf(tick)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={yOf(tick) + 4}
            textAnchor="end"
            fill="#8b95a6"
            fontSize={10}
            fontFamily='"Be Vietnam Pro", sans-serif'
          >
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        ))}

        {xTicks.map((sec) => {
          const idx = MAX_POINTS - 1 - sec;
          if (idx < 0) return null;
          return (
            <text
              key={sec}
              x={xOf(idx)}
              y={H - 4}
              textAnchor="middle"
              fill="#8b95a6"
              fontSize={10}
              fontFamily='"Be Vietnam Pro", sans-serif'
            >
              -{sec}s
            </text>
          );
        })}

        {fills.map((d, i) => (
          <path key={i} d={d} fill={fillColor} opacity={0.5} stroke="none" />
        ))}

        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {currentVal !== null && (
          <>
            <line
              x1={xOf(currentIdx)}
              y1={PAD.top}
              x2={xOf(currentIdx)}
              y2={PAD.top + plotH}
              stroke={LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.4}
            />
            <circle
              cx={xOf(currentIdx)}
              cy={yOf(currentVal)}
              r={3.5}
              fill={LINE_COLOR}
            />
          </>
        )}
      </svg>

      {label && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {statusLabel && (
              <span
                style={{
                  fontFamily: '"Be Vietnam Pro", sans-serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            )}
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 18,
                color: "#9ca3af",
                letterSpacing: "0.18px",
              }}
            >
              {label}
            </span>
          </div>
          {currentVal !== null && (
            <span
              style={{
                color: "#ffffff",
                fontWeight: 700,
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 31,
              }}
            >
              {currentVal.toFixed(1)}
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 400,
                  color: "#9ca3af",
                  marginLeft: 4,
                }}
              >
                {unit}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
