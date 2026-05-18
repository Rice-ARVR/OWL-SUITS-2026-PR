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

    // SVG y is negated: world +y (North) maps to SVG -y (visual top)
    const svgTop = -viewBox.y - viewBox.h;
    const svgBottom = -viewBox.y;

    for (let x = startX; x <= endX; x += spacing) {
        lines.push(
            <line
                key={`v-${x}`}
                x1={x}
                y1={svgTop}
                x2={x}
                y2={svgBottom}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
        if (x % labelInterval === 0) {
            lines.push(
                <text
                    key={`lx-${x}`}
                    x={x}
                    y={svgTop + fontSize + 4}
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
                y1={-y}
                x2={viewBox.x + viewBox.w}
                y2={-y}
                stroke="#3a3a40"
                strokeWidth="1"
            />,
        );
        if (y % labelInterval === 0) {
            lines.push(
                <text
                    key={`ly-${y}`}
                    x={viewBox.x + 4}
                    y={-y + fontSize / 3}
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
