import type { CSSProperties } from "react";
import { SeverityGlow, type Severity } from "~/components/ui/TelemetryHighlight";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: CSSProperties["padding"];
  severity?: Severity;
}

export default function Card({ title, children, className, style, padding = "var(--card-padding, 20px)", severity = "nominal" }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "#3A3A41",
        borderRadius: "var(--card-radius, 12px)",
        padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        ...style,
      }}
    >
      {children}
      <SeverityGlow severity={severity} radius={12} />
    </div>
  );
}
