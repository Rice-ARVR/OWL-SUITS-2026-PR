interface OtherPressureProps {
  value: number | null;
  unit?: string;
  isWarning?: boolean;
}

export default function OtherPressure({
  value,
  unit = "psi",
  isWarning,
}: OtherPressureProps) {
  const statusLabel = isWarning ? "Unsafe" : "Safe";
  const statusColor = isWarning ? "#F59095" : "#9DE4CE";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#2e2e32",
        borderRadius: 10,
        width: "100%",
      }}
    >
      {/* Icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5" cy="8" r="4" stroke="#9ca3af" strokeWidth="1.5" />
        <circle cx="11" cy="8" r="4" stroke="#9ca3af" strokeWidth="1.5" />
      </svg>

      {/* Status + label */}
      <span
        style={{
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: 13,
          color: statusColor,
          fontWeight: 600,
        }}
      >
        {statusLabel}
      </span>
      <span
        style={{
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: 13,
          color: "#9ca3af",
          flex: 1,
        }}
      >
        Other pressure
      </span>

      {/* Value */}
      <span
        style={{
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: "#ffffff",
        }}
      >
        {value !== null && value !== undefined ? value.toFixed(1) : "--"}
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: "#9ca3af",
            marginLeft: 3,
          }}
        >
          {unit}
        </span>
      </span>
    </div>
  );
}
