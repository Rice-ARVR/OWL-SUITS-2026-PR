import type { ViewBox } from "~/types/map";

export function Grid({ spacing, viewBox }: { spacing: number; viewBox: ViewBox }) {
    const lines = [];
    const startX = Math.floor(viewBox.x / spacing) * spacing;
    const startY = Math.floor(viewBox.y / spacing) * spacing;
    const endX = viewBox.x + viewBox.w;
    const endY = viewBox.y + viewBox.h;

    // Pick a label interval that avoids clutter
    const labelInterval = viewBox.w > 2000 ? 500 : viewBox.w > 800 ? 200 : 100;
    const fontSize = Math.max(10, viewBox.w * 0.012);

    for (let x = startX; x <= endX; x += spacing) {
        lines.push(
            <line
                key={`v-${x}`}
                x1={x}
                y1={viewBox.y}
                x2={x}
                y2={viewBox.y + viewBox.h}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
        // Coordinate label on X axis
        if (x % labelInterval === 0) {
            lines.push(
                <text
                    key={`lx-${x}`}
                    x={x}
                    y={viewBox.y + fontSize + 4}
                    textAnchor="middle"
                    fill="#555"
                    fontSize={fontSize}
                    style={{ userSelect: "none" }}
                >
                    {x}
                </text>,
            );
        }
    }
    for (let y = startY; y <= endY; y += spacing) {
        lines.push(
            <line
                key={`h-${y}`}
                x1={viewBox.x}
                y1={y}
                x2={viewBox.x + viewBox.w}
                y2={y}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
        // Coordinate label on Y axis
        if (y % labelInterval === 0) {
            lines.push(
                <text
                    key={`ly-${y}`}
                    x={viewBox.x + 4}
                    y={y + fontSize / 3}
                    textAnchor="start"
                    fill="#555"
                    fontSize={fontSize}
                    style={{ userSelect: "none" }}
                >
                    {y}
                </text>,
            );
        }
    }
    return <g>{lines}</g>;
}
