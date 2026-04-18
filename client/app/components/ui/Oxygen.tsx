interface OxygenProps {
  level: number; // 0–100
  tankLabel?: string;
  remaining?: string;
}

export default function Oxygen({
  level,
  tankLabel = "Tank 1",
  remaining = "8:00:00 Remaining",
}: OxygenProps) {
  const clamped = Math.min(100, Math.max(0, level));
  const isLow = clamped < 50;
  const fillColor = isLow ? "#A27077" : "#C3D2CE";
  const outerRadius = 68;
  const outerStrokeWidth = 8;
  const innerRadius = 50;
  const innerStrokeWidth = 10;
  const innerCircumference = Math.PI * innerRadius;
  const fillOffset = innerCircumference * (1 - clamped / 100);

  const pct = clamped / 100;
  const theta = Math.PI * (1 - pct);
  const indicator = {
    x: innerRadius * Math.cos(theta),
    y: -innerRadius * Math.sin(theta),
  };

  const TICK_PCTS = [1/6, 2/6, 3/6, 4/6, 5/6];
  function arcPoint(r: number, p: number) {
    const t = Math.PI * (1 - p);
    return { x: r * Math.cos(t), y: -r * Math.sin(t) };
  }

  return (
    <div
      style={{
        background: "#3a3a41",
        borderRadius: "12px",
        padding: "20px",
        width: "100%",
        maxWidth: 240,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 148,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 11,
        }}
      >
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
              {/* Thin outer ring */}
              <path
                d={`M ${-outerRadius} 0 A ${outerRadius} ${outerRadius} 0 0 1 ${outerRadius} 0`}
                fill="none"
                stroke="#6d7077"
                strokeWidth={outerStrokeWidth}
                strokeLinecap="round"
              />
              {/* Inner track — always complete */}
              <path
                d={`M ${-innerRadius} 0 A ${innerRadius} ${innerRadius} 0 0 1 ${innerRadius} 0`}
                fill="none"
                stroke="#6d7077"
                strokeWidth={innerStrokeWidth}
                strokeLinecap="round"
              />
              {/* Fill arc */}
              <path
                d={`M ${-innerRadius} 0 A ${innerRadius} ${innerRadius} 0 0 1 ${innerRadius} 0`}
                fill="none"
                stroke={fillColor}
                strokeWidth={innerStrokeWidth}
                strokeLinecap="round"
                strokeDasharray={innerCircumference}
                strokeDashoffset={fillOffset}
                opacity={0.4}
              />
              {/* Ticks on top of outer ring */}
              {TICK_PCTS.map((p) => {
                const outer = arcPoint(innerRadius + 4, p);
                const inner = arcPoint(innerRadius - 4, p);
                return (
                  <line
                    key={p}
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
              {/* Indicator circle */}
              <circle cx={indicator.x} cy={indicator.y} r={5} fill="white" />
            </g>
          </svg>

          <div
            style={{
              position: "absolute",
              top: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 26,
                fontWeight: 500,
                color: "#ffffff",
              }}
            >
              {clamped.toFixed(0)}%
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
              {tankLabel}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 11,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="8"
                y="4"
                width="8"
                height="16"
                rx="3"
                fill="#c5c9d2"
                opacity="0.28"
              />
              <rect
                x="10"
                y="2"
                width="4"
                height="4"
                rx="1"
                fill="#c5c9d2"
                opacity="0.28"
              />
              <path
                d="M10 9H14M10 13H14"
                stroke="#9de4ce"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 18,
              fontWeight: 400,
              color: "#c5c9d2",
              letterSpacing: "0.18px",
            }}
          >
            Oxygen storage
          </span>
        </div>
        <div
          style={{
            background: "#333734",
            borderRadius: 8,
            padding: "5px 10px",
          }}
        >
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 18,
              color: "#9de4ce",
              letterSpacing: "0.18px",
            }}
          >
            {remaining}
          </span>
        </div>
      </div>
    </div>
  );
}
