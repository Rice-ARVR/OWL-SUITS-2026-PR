import type { MapPoint, RoverPosition } from "~/types/map";

export function Marker({
    point,
    roverPosition,
    onDelete,
    isHovered,
    onHover,
    onLeave,
}: {
    point: MapPoint;
    roverPosition: RoverPosition;
    onDelete: (id: string) => void;
    isHovered: boolean;
    onHover: () => void;
    onLeave: () => void;
}) {
    const color = "#6ee7b7";

    const dx = point.x - roverPosition.x;
    const dy = point.y - roverPosition.y;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

    const descText = point.description?.trim() || "";
    const tooltipW = 180;
    const charsPerLine = 22;
    const estimatedLines = Math.ceil(descText.length / charsPerLine);
    const tooltipH = Math.max(30, estimatedLines * 16 + 14);
    const tooltipX = point.x - tooltipW / 2;

    // Negate y: world +y (North) = SVG -y (visual top).
    // Offsets (e.g. -26 for bulb height, +14 for label) stay in SVG screen-space.
    const sy = -point.y;
    const tooltipY = sy - 55 - tooltipH;

    return (
        <g onMouseEnter={onHover} onMouseLeave={onLeave}>
            {/* Pin shape — tip at (point.x, sy) */}
            <path
                d={`M ${point.x} ${sy}
            C ${point.x - 4} ${sy - 6}, ${point.x - 14} ${sy - 16}, ${point.x - 14} ${sy - 26}
            A 14 14 0 1 1 ${point.x + 14} ${sy - 26}
            C ${point.x + 14} ${sy - 16}, ${point.x + 4} ${sy - 6}, ${point.x} ${sy} Z`}
                fill={color}
                stroke="#1e1e22"
                strokeWidth="2"
            />
            <circle cx={point.x} cy={sy - 26} r="5" fill="#1e1e22" />

            <text x={point.x} y={sy + 14} textAnchor="middle" fill="#ccc" fontSize="11">
                {point.label}: {distance}m
            </text>

            {isHovered && (
                <g
                    cursor="pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(point.id);
                    }}
                >
                    <circle
                        cx={point.x + 12}
                        cy={sy - 38}
                        r="8"
                        fill="#1e1e22"
                        stroke="#888"
                        strokeWidth="1"
                    />
                    <line
                        x1={point.x + 8}
                        y1={sy - 42}
                        x2={point.x + 16}
                        y2={sy - 34}
                        stroke="#e74c3c"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                    <line
                        x1={point.x + 16}
                        y1={sy - 42}
                        x2={point.x + 8}
                        y2={sy - 34}
                        stroke="#e74c3c"
                        strokeWidth="2"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                </g>
            )}

            {isHovered && descText && (
                <g>
                    <rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipW}
                        height={tooltipH}
                        rx="6"
                        fill="#1e1e22"
                        stroke="#444"
                        strokeWidth="1"
                    />
                    <polygon
                        points={`${point.x - 6},${tooltipY + tooltipH} ${point.x + 6},${tooltipY + tooltipH} ${point.x},${tooltipY + tooltipH + 8}`}
                        fill="#1e1e22"
                        stroke="#444"
                        strokeWidth="1"
                    />
                    <line
                        x1={point.x - 6}
                        y1={tooltipY + tooltipH}
                        x2={point.x + 6}
                        y2={tooltipY + tooltipH}
                        stroke="#1e1e22"
                        strokeWidth="2"
                    />
                    <foreignObject
                        x={tooltipX + 8}
                        y={tooltipY + 6}
                        width={tooltipW - 16}
                        height={tooltipH - 12}
                    >
                        <div
                            style={{
                                color: "#ccc",
                                fontSize: "11px",
                                lineHeight: "1.4",
                                overflow: "hidden",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                whiteSpace: "normal",
                            }}
                        >
                            {descText}
                        </div>
                    </foreignObject>
                </g>
            )}
        </g>
    );
}
