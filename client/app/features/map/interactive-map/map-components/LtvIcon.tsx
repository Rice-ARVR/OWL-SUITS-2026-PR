export function LtvIcon({
    x,
    y,
    onHover,
    onLeave,
}: {
    x: number;
    y: number;
    onHover?: () => void;
    onLeave?: () => void;
}) {
    const color = "#fbbf24";

    return (
        <g
            transform={`translate(${x}, ${-y})`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            style={{ cursor: "default" }}
        >
            {/* Shadow */}
            <ellipse cx="0" cy="4" rx="14" ry="5" fill="rgba(0,0,0,0.3)" />

            {/* Body */}
            <rect
                x="-11"
                y="-9"
                width="22"
                height="16"
                rx="3"
                fill="#5a4a1c"
                stroke={color}
                strokeWidth="1.5"
            />

            {/* Cabin / top */}
            <rect
                x="-6"
                y="-14"
                width="12"
                height="7"
                rx="2"
                fill="#6b5a24"
                stroke={color}
                strokeWidth="1"
            />

            {/* Wheels */}
            <circle cx="-12" cy="-6" r="3" fill="#333" stroke={color} strokeWidth="1" />
            <circle cx="12" cy="-6" r="3" fill="#333" stroke={color} strokeWidth="1" />
            <circle cx="-12" cy="5" r="3" fill="#333" stroke={color} strokeWidth="1" />
            <circle cx="12" cy="5" r="3" fill="#333" stroke={color} strokeWidth="1" />

            {/* Beacon */}
            <line x1="0" y1="-14" x2="0" y2="-22" stroke={color} strokeWidth="1.5" />
            <circle cx="0" cy="-23" r="2" fill={color}>
                <animate
                    attributeName="opacity"
                    values="1;0.3;1"
                    dur="1.8s"
                    repeatCount="indefinite"
                />
            </circle>

            {/* Label */}
            <text x="0" y="20" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold">
                LTV
            </text>
        </g>
    );
}
