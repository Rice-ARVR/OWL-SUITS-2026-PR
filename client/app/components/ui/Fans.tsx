import { useEffect, useRef } from "react";

interface FanStatus {
  label: string;
  rpm: number;
}

function useTrend(value: number): "up" | "down" | "stable" {
  const prev = useRef<number | null>(null);
  const trend = useRef<"up" | "down" | "stable">("stable");

  useEffect(() => {
    if (prev.current !== null) {
      if (value > prev.current) trend.current = "up";
      else if (value < prev.current) trend.current = "down";
      else trend.current = "stable";
    }
    prev.current = value;
  }, [value]);

  return trend.current;
}

interface FansProps {
  caption?: string;
  fans?: FanStatus[];
  safeMinRpm?: number;
  safeMaxRpm?: number;
}

const imgEllipse2 =
  "https://www.figma.com/api/mcp/asset/326bf7fd-f943-4e0b-b93b-609d3737f912";
const imgVector = "/fan.png";

const FanArrowIcon = ({ direction = "up" }: { direction?: "up" | "down" }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{
      transform: direction === "down" ? "rotate(180deg)" : "none",
      flexShrink: 0,
    }}
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

function FanItem({ fan }: { fan: FanStatus }) {
  const direction = useTrend(fan.rpm);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <p
        style={{
          margin: 0,
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: 18,
          fontWeight: 400,
          lineHeight: "100%",
          color: "#a1a4af",
          letterSpacing: "0.18px",
          whiteSpace: "nowrap",
        }}
      >
        {fan.label}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 47,
          marginTop: 3,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 18,
            fontWeight: 400,
            lineHeight: "100%",
            color: "#c5c9d2",
            letterSpacing: "0.18px",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{fan.rpm} </span>
          <span style={{ fontSize: 16, letterSpacing: "0.64px" }}>rpm</span>
        </p>
        <FanArrowIcon direction={direction === "stable" ? "up" : direction} />
      </div>
    </div>
  );
}

export default function Fans({
  caption = "fan operation",
  fans = [
    { label: "Fan 1", rpm: 3000 },
    { label: "Fan 2", rpm: 3000 },
  ],
  safeMinRpm = 500,
  safeMaxRpm = 5000,
}: FansProps) {
  const allSafe = fans.every((f) => f.rpm >= safeMinRpm && f.rpm <= safeMaxRpm);
  const mode = allSafe ? "Normal" : "Failure";
  const modeColor = allSafe ? "#9DE4CE" : "#F59095";

  return (
    <div
      style={{
        background: "#2e2e32",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 5,
          background: "#3b3a41",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 38,
            width: 30,
            height: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "scaleY(-1)",
          }}
        >
          <img
            src={imgEllipse2}
            alt="Icon glow"
            style={{ width: 30, height: 4, display: "block" }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6.26,
            width: 34,
            height: 34,
          }}
        >
          <img
            src={imgVector}
            alt="Fan icon"
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 9,
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 16,
            fontWeight: 400,
            lineHeight: "100%",
            color: "#c5c9d2",
            letterSpacing: "0.64px",
            margin: 0,
          }}
        >
          <span style={{ color: modeColor }}>{mode}</span>
          <span>{` ${caption}`}</span>
        </p>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {fans.map((fan) => (
            <FanItem key={fan.label} fan={fan} />
          ))}
        </div>
      </div>
    </div>
  );
}
