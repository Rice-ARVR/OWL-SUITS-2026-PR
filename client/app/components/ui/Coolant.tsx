interface CoolantProps {
  storage: number | null;
  pressure: number | null;
  pressureUnit?: string;
}

export default function Coolant({
  storage,
  pressure,
  pressureUnit = "psi",
}: CoolantProps) {
  const storagePct = Math.min(100, Math.max(0, storage ?? 0));
  const isLow = storagePct < 50;
  const fillColor = isLow ? "#A27077" : "#C3D2CE";

  return (
    <div
      style={{
        background: "#2E2E32",
        borderRadius: 12,
        padding: "16px 12px",
        width: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
      }}
    >
      {/* Left: storage */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 140,
        }}
      >
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            color: "#9ca3af",
            letterSpacing: "0.18px",
          }}
        >
          Coolant Storage
        </span>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          {storage !== null ? `${storagePct.toFixed(0)}%` : "--"}
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#9ca3af",
              marginLeft: 4,
            }}
          >
            full
          </span>
        </span>
        {/* Percentage bar */}
        <div
          style={{
            width: "100%",
            height: 6,
            background: "#3a3a41",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${storagePct}%`,
              height: "100%",
              background: fillColor,
              borderRadius: 99,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "rgba(255,255,255,0.08)",
        }}
      />

      {/* Right: pressure */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            color: "#9de4ce",
            fontWeight: 600,
          }}
        >
          Safe
        </span>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            color: "#9ca3af",
            letterSpacing: "0.18px",
          }}
        >
          Coolant Pressure
        </span>
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          {pressure !== null ? pressure.toFixed(0) : "--"}
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#9ca3af",
              marginLeft: 4,
            }}
          >
            {pressureUnit}
          </span>
        </span>
      </div>
    </div>
  );
}
