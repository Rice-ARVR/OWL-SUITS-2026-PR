<<<<<<< HEAD
import type { CSSProperties } from "react";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: CSSProperties;
  padding?: CSSProperties["padding"];
}

export default function Card({ title, children, style, padding = "16px" }: CardProps) {
  return (
    <div
      style={{
        background: "#3A3A41",
        borderRadius: 12,
        padding,
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
=======
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
>>>>>>> 29c0ad7a275e5dcef28b1acd66d68441b29e08d4
