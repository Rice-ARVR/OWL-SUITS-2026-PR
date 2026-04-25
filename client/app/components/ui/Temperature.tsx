<<<<<<< HEAD
import { useEffect, useRef } from "react";

import typo from "~/components/ui/typography.module.css";

interface TemperatureProps {
    temperature: number | null;
    outsideTemperature?: number | null;
    unit?: string;
    target?: number | null;
}

const TEMP_MIN = 0;
const TEMP_MAX = 30;

function arcPoint(radius: number, pct: number) {
    const theta = Math.PI * (1 - pct);
    return { x: radius * Math.cos(theta), y: -radius * Math.sin(theta) };
}

function tempToPct(temp: number) {
    return Math.min(1, Math.max(0, (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)));
}

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

function TrendArrow({ direction }: { direction: Trend }) {
    if (direction === "stable") return null;
    return (
        <svg
            width="16"
            height="16"
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

export default function Temperature({
    temperature,
    outsideTemperature,
    unit = "°",
    target,
}: TemperatureProps) {
    const value =
        Number.isFinite(temperature) && temperature !== null ? (temperature as number) : TEMP_MIN;
    const radius = 94;
    const pct = tempToPct(value);
    const outsideTrend = useTrend(
        outsideTemperature !== undefined && outsideTemperature !== null ? outsideTemperature : null,
    );

    const indicator = arcPoint(radius, pct);

    return (
        <div
            style={{
                background: "#3a3a41",
                borderRadius: 12,
                padding: 20,
                width: "100%",
                maxWidth: 240,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
            }}
        >
            {/* Semicircle gauge */}
            <div
                style={{
                    position: "relative",
                    width: 200,
                    height: 106,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <svg viewBox="0 0 200 106" width="200" height="106" style={{ overflow: "visible" }}>
                    <path
                        d="M194 100C194 87.6557 191.569 75.4324 186.845 64.0278C182.121 52.6231 175.197 42.2607 166.468 33.532C157.739 24.8033 147.377 17.8793 135.972 13.1553C124.568 8.43138 112.344 6 100 6C87.6557 6 75.4324 8.43138 64.0278 13.1553C52.6231 17.8793 42.2607 24.8033 33.532 33.532C24.8033 42.2607 17.8793 52.6232 13.1553 64.0278C8.43138 75.4324 6 87.6557 6 100"
                        fill="none"
                        stroke="#74857F"
                        strokeOpacity="0.35"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    <path
                        d="M147.398 20.1973L148.988 17.6531"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M53.0078 20.1973L51.4181 17.6531"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M22.0156 43.1621L25.0798 45.7333"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M10.1172 75L7.31645 73.9249"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M177.391 44.0991L174.326 46.6703"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M189.336 74.999L192.137 73.9239"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <path
                        d="M100.5 8V4"
                        stroke="#F1F2F5"
                        strokeOpacity="0.4"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx={100 + indicator.x} cy={100 + indicator.y} r={6.5} fill="#F1F2F5" />
                </svg>

                {/* Center text */}
                <div
                    style={{
                        position: "absolute",
                        marginTop: 130,
                        left: 0,
                        right: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span className={typo.h2} style={{ color: "#F1F2F5", lineHeight: 1 }}>
                        {temperature !== null && Number.isFinite(temperature)
                            ? `${Math.round(temperature as number)}${unit}`
                            : "--"}
                    </span>
                    <span className={typo.p} style={{ color: "#C5C9D2" }}>
                        Cabin Temp.
                    </span>
                    <span className={typo.p} style={{ color: "#C5C9D2" }}>
                        Set to{" "}
                        {target !== null && Number.isFinite(target)
                            ? `${Math.round(target as number)}${unit}`
                            : "--"}
                    </span>
                </div>
            </div>

            {/* Outside temperature box */}
            {outsideTemperature !== undefined && (
                <div
                    style={{
                        display: "flex",
                        padding: 20,
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 20,
                        borderRadius: 12,
                        background: "#2E2E32",
                        height: 96,
                        width: 305,
                        marginTop: 80,
                    }}
                >
                    <span className={typo.h5} style={{ color: "#C5C9D2" }}>
                        Outside temperature
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={typo.h4} style={{ color: "#E8EBF2" }}>
                            {outsideTemperature !== null && Number.isFinite(outsideTemperature)
                                ? `${Math.round(outsideTemperature as number)}${unit}`
                                : "--"}
                        </span>
                        <TrendArrow direction={outsideTrend} />
                    </div>
                </div>
            )}
        </div>
    );
=======
interface TemperatureProps {
  temperature: number | null;
  outsideTemperature?: number | null;
  unit?: string;
}

// Arc range: 0°C–30°C, centered at 15°C (top of arc)
const TEMP_MIN = 0;
const TEMP_MAX = 30;
const TICK_INTERVAL = 10;

function arcPoint(radius: number, pct: number) {
  const theta = Math.PI * (1 - pct);
  return {
    x: radius * Math.cos(theta),
    y: -radius * Math.sin(theta),
  };
}

function tempToPct(temp: number) {
  return Math.min(1, Math.max(0, (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)));
}

export default function Temperature({
  temperature,
  outsideTemperature,
  unit = "°C",
}: TemperatureProps) {
  const value =
    Number.isFinite(temperature) && temperature !== null
      ? (temperature as number)
      : TEMP_MIN;
  const radius = 68;
  const pct = tempToPct(value);

  // Tick marks every 10°C, excluding endpoints
  const ticks: number[] = [];
  for (let t = TEMP_MIN + TICK_INTERVAL; t < TEMP_MAX; t += TICK_INTERVAL) {
    ticks.push(t);
  }

  // Indicator circle position on the arc
  const indicator = arcPoint(radius, pct);

  return (
    <div
      style={{
        background: "#3a3a41",
        borderRadius: 12,
        padding: 20,
        width: "100%",
        maxWidth: 240,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      {/* Semicircle gauge */}
      <div
        style={{
          position: "relative",
          width: 148,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 148 100"
          width="148"
          height="100"
          style={{ overflow: "visible" }}
        >
          <g transform="translate(74, 80)">
            {/* Background arc */}
            <path
              d={`M ${-radius} 0 A ${radius} ${radius} 0 0 1 ${radius} 0`}
              fill="none"
              stroke="#4E5457"
              strokeWidth={12}
              strokeLinecap="round"
            />

            {/* Partition tick marks inside the arc */}
            {ticks.map((t) => {
              const p = tempToPct(t);
              const outer = arcPoint(radius + 4, p);
              const inner = arcPoint(radius - 4, p);
              return (
                <line
                  key={t}
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke="#8F9396"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Current temperature indicator circle */}
            <circle cx={indicator.x} cy={indicator.y} r={5} fill="white" />
          </g>
        </svg>

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 26,
              fontWeight: 500,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {temperature !== null && Number.isFinite(temperature)
              ? `${(temperature as number).toFixed(1)}${unit}`
              : "--"}
          </span>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 16,
              fontWeight: 400,
              color: "#c5c9d2",
              letterSpacing: "0.18px",
            }}
          >
            Cabin Temp.
          </span>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 12,
              color: "#a1a4af",
              letterSpacing: "0.18px",
            }}
          >
            Set to 15{unit}
          </span>
        </div>
      </div>

      {/* Outside temperature box */}
      {outsideTemperature !== undefined && (
        <div
          style={{
            background: "#2E2E32",
            borderRadius: 8,
            padding: "5px 10px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 14,
              color: "#a1a4af",
              letterSpacing: "0.18px",
            }}
          >
            Outside temperature
          </span>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 18,
              color: "#ffffff",
              letterSpacing: "0.18px",
            }}
          >
            {outsideTemperature !== null && Number.isFinite(outsideTemperature)
              ? `${(outsideTemperature as number).toFixed(1)}${unit}`
              : "--"}
          </span>
        </div>
      )}
    </div>
  );
>>>>>>> 29c0ad7a275e5dcef28b1acd66d68441b29e08d4
}
