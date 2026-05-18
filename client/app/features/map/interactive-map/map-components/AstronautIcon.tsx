export function AstronautIcon({
    x,
    y,
    heading,
    label,
    onHover,
    onLeave,
}: {
    x: number;
    y: number;
    heading: number;
    label: "EVA1" | "EVA2";
    onHover?: () => void;
    onLeave?: () => void;
}) {
    const color = label === "EVA1" ? "#93c5fd" : "#f9a8d4";

    return (
        <g
            transform={`translate(${x}, ${-y}) rotate(${heading})`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            style={{ cursor: "default" }}
        >
            {/* Shadow */}
            <ellipse cx="0" cy="4" rx="12" ry="4" fill="rgba(0,0,0,0.3)" />

            {/* Body */}
            <rect x="-8" y="-4" width="16" height="14" rx="3" fill="#888" stroke="#bbb" strokeWidth="1" />

            {/* Helmet */}
            <circle cx="0" cy="-12" r="10" fill="#aaa" stroke="#ccc" strokeWidth="1.5" />

            {/* Visor */}
            <ellipse cx="0" cy="-12" rx="6" ry="5" fill={color} opacity="0.85" />

            {/* Direction indicator */}
            <polygon points="-3,-4 3,-4 0,-8" fill={color} opacity="0.9" />

            {/* Label */}
            <text
                x="0"
                y="20"
                textAnchor="middle"
                fill={color}
                fontSize="9"
                fontWeight="bold"
            >
                {label}
            </text>
        </g>
    );
}
