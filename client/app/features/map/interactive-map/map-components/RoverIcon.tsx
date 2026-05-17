import type { RoverPosition } from "~/types/map";

export function RoverIcon({ position }: { position: RoverPosition }) {
    // Negate y so world +y (North) maps to SVG -y (visual top).
    // Heading rotation stays clockwise-positive: 0°=North, 90°=East matches the display.
    return (
        <g transform={`translate(${position.x}, ${-position.y}) rotate(${position.heading})`}>
            {/* Shadow */}
            <ellipse cx="0" cy="2" rx="18" ry="6" fill="rgba(0,0,0,0.3)" />

            {/* Body */}
            <rect
                x="-14"
                y="-12"
                width="28"
                height="20"
                rx="4"
                fill="#555"
                stroke="#888"
                strokeWidth="1.5"
            />

            {/* Cabin / top */}
            <rect
                x="-8"
                y="-18"
                width="16"
                height="10"
                rx="3"
                fill="#666"
                stroke="#888"
                strokeWidth="1"
            />

            {/* Wheels */}
            <circle cx="-16" cy="-8" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="16" cy="-8" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="-16" cy="6" r="4" fill="#333" stroke="#777" strokeWidth="1" />
            <circle cx="16" cy="6" r="4" fill="#333" stroke="#777" strokeWidth="1" />

            {/* Antenna */}
            <line x1="0" y1="-18" x2="0" y2="-28" stroke="#aaa" strokeWidth="1.5" />
            <circle cx="0" cy="-29" r="2" fill="#6ee7b7" />

            {/* Direction indicator (front) */}
            <polygon points="-4,-12 4,-12 0,-16" fill="#6ee7b7" opacity="0.8" />

            {/* Label */}
            <text x="0" y="22" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">
                ROVER
            </text>
        </g>
    );
}
