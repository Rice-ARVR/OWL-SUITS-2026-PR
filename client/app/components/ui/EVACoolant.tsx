interface EVACoolantProps {
  coolantStorage: number | null;
  liquidPressure: number | null;
  gasPressure: number | null;
  liquidSafeMin?: number;
  liquidSafeMax?: number;
  gasSafeMin?: number;
  gasSafeMax?: number;
}

const INNER_RADIUS = 50;
const INNER_STROKE = 10;

const TICK_PCTS = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];

function arcPoint(r: number, p: number) {
  const t = Math.PI * (1 - p);
  return { x: r * Math.cos(t), y: -r * Math.sin(t) };
}

export default function EVACoolant({
  coolantStorage,
  liquidPressure,
  gasPressure,
  liquidSafeMin = 200,
  liquidSafeMax = 1000,
  gasSafeMin = 0,
  gasSafeMax = 700,
}: EVACoolantProps) {
  const liquidInRange = liquidPressure !== null && liquidPressure >= liquidSafeMin && liquidPressure <= liquidSafeMax;
  const liquidStatus = liquidPressure === null ? "Normal" : liquidInRange ? "Normal" : "Critical";
  const liquidColor = liquidPressure === null || liquidInRange ? "#9DE4CE" : "#F59095";

  const gasInRange = gasPressure !== null && gasPressure >= gasSafeMin && gasPressure <= gasSafeMax;
  const gasStatus = gasPressure === null ? "Safe" : gasInRange ? "Safe" : "Unsafe";
  const gasColor = gasPressure === null || gasInRange ? "#9DE4CE" : "#F59095";
  const clamped = Math.min(100, Math.max(0, coolantStorage ?? 0));
  const isLow = clamped < 50;
  const fillColor = isLow ? "#A27077" : "#C3D2CE";
  const circumference = Math.PI * INNER_RADIUS;
  const fillOffset = circumference * (1 - clamped / 100);

  const pct = clamped / 100;
  const theta = Math.PI * (1 - pct);
  const indicator = {
    x: INNER_RADIUS * Math.cos(theta),
    y: -INNER_RADIUS * Math.sin(theta),
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
      {/* Gauge */}
      <div
        style={{ position: "relative", width: 148, height: 100, flexShrink: 0, zoom: 1.3 }}
      >
        <svg
          viewBox="0 0 148 100"
          width="148"
          height="100"
          style={{ overflow: "visible" }}
        >
          <g transform="translate(74, 80)">
            <path
              d={`M ${-INNER_RADIUS} 0 A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 1 ${INNER_RADIUS} 0`}
              fill="none"
              stroke="#6d7077"
              strokeWidth={INNER_STROKE}
              strokeLinecap="round"
            />
            <path
              d={`M ${-INNER_RADIUS} 0 A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 1 ${INNER_RADIUS} 0`}
              fill="none"
              stroke={fillColor}
              strokeWidth={INNER_STROKE}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={fillOffset}
              opacity={0.4}
            />
            {TICK_PCTS.map((p) => {
              const outer = arcPoint(INNER_RADIUS + 4, p);
              const inner = arcPoint(INNER_RADIUS - 4, p);
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
            <circle cx={indicator.x} cy={indicator.y} r={5} fill="white" />
          </g>
        </svg>

        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
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
            {coolantStorage !== null ? `${clamped.toFixed(0)}%` : "--"}
          </span>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 13,
              color: "#a1a4af",
              letterSpacing: "0.18px",
            }}
          >
            Coolant Storage
          </span>
        </div>
      </div>

      {/* Pressure metrics */}
      <div
        style={{
          background: "#2e2e32",
          borderRadius: 10,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: liquidColor,
              }}
            >
              {liquidStatus}
            </span>
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 13,
                color: "#c5c9d2",
              }}
            >
              Liquid Pressure
            </span>
          </div>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 18,
              fontWeight: 500,
              color: "#a1a4af",
            }}
          >
            {liquidPressure !== null
              ? `${liquidPressure.toFixed(2)} psi`
              : "--"}
          </span>
        </div>

        <div
          style={{
            width: "100%",
            height: 1,
            background: "rgba(255,255,255,0.08)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: gasColor,
              }}
            >
              {gasStatus}
            </span>
            <span
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontSize: 13,
                color: "#c5c9d2",
              }}
            >
              Gas Pressure
            </span>
          </div>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 18,
              fontWeight: 500,
              color: "#a1a4af",
            }}
          >
            {gasPressure !== null ? `${gasPressure.toFixed(2)} psi` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
