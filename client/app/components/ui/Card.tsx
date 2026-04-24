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
        background: "#3A3A41",
        borderRadius: 12,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
