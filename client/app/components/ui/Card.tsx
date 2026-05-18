import type { CSSProperties } from "react";
import { SeverityGlow, type Severity } from "~/components/ui/TelemetryHighlight";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: CSSProperties;
  padding?: CSSProperties["padding"];
  severity?: Severity;
}

export default function Card({ title, children, style, padding = "16px", severity = "nominal" }: CardProps) {
  return (
    <div
      style={{
        background: "#3A3A41",
        borderRadius: 12,
        padding,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        ...style,
      }}
    >
      {children}
      <SeverityGlow severity={severity} radius={12} />
    </div>
  );
}
