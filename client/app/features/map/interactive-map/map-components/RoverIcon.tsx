import type { RoverPosition } from "~/types/map";

export function RoverIcon({
    position,
    onHover,
    onLeave,
}: {
    position: RoverPosition;
    onHover?: () => void;
    onLeave?: () => void;
}) {
    // Negate y so world +y (North) maps to SVG -y (visual top).
    // Heading rotation stays clockwise-positive: 0°=North, 90°=East matches the display.
    return (
        <g
            transform={`translate(${position.x}, ${-position.y}) rotate(${position.heading})`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            style={{ cursor: "default" }}
        >
            {/* Shadow */}
            <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.3)" />

            {/* Arrow body (centered on origin so rotation pivots correctly) */}
            <g transform="translate(-17, -16)">
                <path
                    d="M17.0009 26.111L27.8986 29.9423C28.1926 30.0621 28.5286 29.9921 28.7536 29.7619C28.8648 29.6485 28.9427 29.5047 28.9783 29.3472C29.0138 29.1897 29.0056 29.025 28.9546 28.8721L17.0009 2L5.04568 28.8721C4.94068 29.1832 5.02018 29.5317 5.24819 29.7619C5.47319 29.9921 5.8092 30.0621 6.1032 29.9423L17.0009 26.111Z"
                    fill="#D9D9D9"
                    stroke="#F1F2F5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </g>
    );
}
