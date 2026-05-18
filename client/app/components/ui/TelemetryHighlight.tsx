import type { CSSProperties, ReactNode } from "react";

export type Severity = "nominal" | "warning" | "critical";

const CRITICAL_BORDER = "rgba(245, 144, 149, 0.5)"; // #F59095 @ 50%

const BORDER_WIDTH = 2;

// Solid colored border overlay. Absolutely positioned + pointer-events: none
// so it adds no layout shift and never intercepts clicks.
export function SeverityGlow({
    severity,
    radius = 12,
}: {
    severity: Severity;
    radius?: number;
}) {
    if (severity !== "critical") return null;
    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                pointerEvents: "none",
                zIndex: 2,
                boxShadow: `inset 0 0 0 ${BORDER_WIDTH}px ${CRITICAL_BORDER}`,
            }}
        />
    );
}

interface TelemetryHighlightProps {
    severity: Severity;
    radius?: number;
    children: ReactNode;
    style?: CSSProperties;
}

// Standalone wrapper for sub-blocks inside a multi-field Card (e.g. a single
// Graph or Pressure). Whole-card cases use Card's own `severity` prop instead.
export default function TelemetryHighlight({
    severity,
    radius = 12,
    children,
    style,
}: TelemetryHighlightProps) {
    return (
        <div style={{ position: "relative", ...style }}>
            {children}
            <SeverityGlow severity={severity} radius={radius} />
        </div>
    );
}
