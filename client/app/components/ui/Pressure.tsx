interface PressureProps {
  value: number | null;
  min: number;
  max: number;
  label?: string;
  unit?: string;
  safeMin?: number;
  safeMax?: number;
}

const RADIUS = 68;
const TICK_PCTS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

function arcPoint(r: number, pct: number) {
  const theta = Math.PI * (1 - pct);
  return { x: r * Math.cos(theta), y: -r * Math.sin(theta) };
}

function arcPath(r: number, pct1: number, pct2: number) {
  const p1 = arcPoint(r, pct1);
  const p2 = arcPoint(r, pct2);
  const largeArc = pct2 - pct1 > 0.5 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

function valueToPct(value: number, min: number, max: number) {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export default function Pressure({
  value,
  min,
  max,
  label,
  unit = "psi",
  safeMin,
  safeMax,
}: PressureProps) {
  const safeMinPct = valueToPct(safeMin ?? min + (max - min) * 0.25, min, max);
  const safeMaxPct = valueToPct(safeMax ?? min + (max - min) * 0.75, min, max);

  const pct =
    value !== null && Number.isFinite(value)
      ? valueToPct(value, min, max)
      : null;

  const indicator = pct !== null ? arcPoint(RADIUS, pct) : null;

  return (
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
            d={arcPath(RADIUS, 0, 1)}
            fill="none"
            stroke="#4F4F59"
            strokeWidth={8}
            strokeLinecap="round"
          />

          {/* Safe zone arc */}
          <path
            d={arcPath(RADIUS, safeMinPct, safeMaxPct)}
            fill="none"
            stroke="#E9FFF6"
            strokeWidth={12}
            strokeLinecap="round"
            strokeOpacity={0.415}
          />

          {/* Tick marks */}
          {TICK_PCTS.map((p) => {
            const outer = arcPoint(RADIUS + 6, p);
            const inner = arcPoint(RADIUS - 6, p);
            return (
              <line
                key={p}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke="#7B7B84"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Indicator circle */}
          {indicator && (
            <circle cx={indicator.x} cy={indicator.y} r={6} fill="#E8EBF2" />
          )}
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
          {value !== null && Number.isFinite(value)
            ? (value as number).toFixed(0)
            : "--"}
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#c5c9d2",
              marginLeft: 6,
            }}
          >
            {unit}
          </span>
        </span>

        {label && (
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: 14,
              color: "#a1a4af",
              letterSpacing: "0.18px",
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
