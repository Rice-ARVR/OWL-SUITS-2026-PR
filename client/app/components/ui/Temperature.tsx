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
}
