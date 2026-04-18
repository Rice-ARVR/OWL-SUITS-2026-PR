import type { CSSProperties } from "react";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: CSSProperties;
}

export default function Card({ title, children, style }: CardProps) {
  return (
    <div
      style={{
        background: "#3a3a41",
        borderRadius: 16,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        ...style,
      }}
    >
      {title && (
        <span
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: "#a1a4af",
            letterSpacing: "0.18px",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      )}
      {children}
    </div>
  );
}
