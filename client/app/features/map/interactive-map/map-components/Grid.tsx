import type { ViewBox } from "~/types/map";

export function Grid({ spacing, viewBox }: { spacing: number; viewBox: ViewBox }) {
    const lines = [];
    const startX = Math.floor(viewBox.x / spacing) * spacing;
    const startY = Math.floor(viewBox.y / spacing) * spacing;
    const endX = viewBox.x + viewBox.w;
    const endY = viewBox.y + viewBox.h;

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
    }
    return <g>{lines}</g>;
}
