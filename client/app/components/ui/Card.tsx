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
