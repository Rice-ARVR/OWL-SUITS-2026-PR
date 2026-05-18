import type { Hazard } from "~/types/map";

export function HazardShape({
    hazard,
    onDelete,
}: {
    hazard: Hazard;
    onDelete: (id: string) => void;
}) {
    // Negate y on all coordinates: world +y (North) = SVG -y (visual top)
    const pointsStr = hazard.points.map((p) => `${p.x},${-p.y}`).join(" ");
    const cx = hazard.points.reduce((sum, p) => sum + p.x, 0) / hazard.points.length;
    const worldCy = hazard.points.reduce((sum, p) => sum + p.y, 0) / hazard.points.length;
    const svgCy = -worldCy;

    const r = 14;
    const octagon = Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
        return `${cx + r * Math.cos(angle)},${svgCy + r * Math.sin(angle)}`;
    }).join(" ");

    const deleteOffsetY = hazard.types.length > 0 ? 44 : 30;

    return (
        <g>
            {hazard.closed ? (
                <polygon
                    points={pointsStr}
                    fill="rgba(255, 138, 117, 0.08)"
                    stroke="#ff8a75"
                    strokeWidth="2"
                />
            ) : (
                <polyline points={pointsStr} fill="none" stroke="#ff8a75" strokeWidth="2" />
            )}

            {hazard.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={-p.y} r="5" fill="#ff8a75" />
            ))}

            {hazard.closed && (
                <>
                    <polygon
                        points={octagon}
                        fill="none"
                        stroke="#ff8a75"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    <line
                        x1={cx}
                        y1={svgCy - 7}
                        x2={cx}
                        y2={svgCy + 2}
                        stroke="#ff8a75"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx={cx} cy={svgCy + 7} r="1.5" fill="#ff8a75" />

                    {hazard.types.length > 0 && (
                        <text x={cx} y={svgCy + 28} textAnchor="middle" fill="#ff8a75" fontSize="10">
                            {hazard.types.join(", ")}
                        </text>
                    )}

                    <g
                        cursor="pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(hazard.id);
                        }}
                    >
                        <circle
                            cx={cx}
                            cy={svgCy + deleteOffsetY}
                            r="9"
                            fill="#1e1e22"
                            stroke="#888"
                            strokeWidth="1"
                        />
                        <line
                            x1={cx - 4}
                            y1={svgCy + deleteOffsetY - 4}
                            x2={cx + 4}
                            y2={svgCy + deleteOffsetY + 4}
                            stroke="#e74c3c"
                            strokeWidth="2"
                            strokeLinecap="round"
                            pointerEvents="none"
                        />
                        <line
                            x1={cx + 4}
                            y1={svgCy + deleteOffsetY - 4}
                            x2={cx - 4}
                            y2={svgCy + deleteOffsetY + 4}
                            stroke="#e74c3c"
                            strokeWidth="2"
                            strokeLinecap="round"
                            pointerEvents="none"
                        />
                    </g>
                </>
            )}
        </g>
    );
}
