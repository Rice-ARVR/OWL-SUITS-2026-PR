import { useEffect, useRef } from "react";

const WS_URL = import.meta.env.VITE_DUST_WS_URL ?? "ws://localhost:8765";

export type StreamStatus = "idle" | "connecting" | "live" | "error";

interface DustStreamViewProps {
    onStatusChange?: (status: StreamStatus, error?: string) => void;
}

export default function DustStreamView({ onStatusChange }: DustStreamViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        onStatusChange?.("connecting");

        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            onStatusChange?.("live");
        };

        ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            const blob = new Blob([event.data], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                if (canvas.width !== img.width || canvas.height !== img.height) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        };

        ws.onerror = () => {
            onStatusChange?.("error", "WebSocket error");
        };

        ws.onclose = (event) => {
            if (!event.wasClean) {
                onStatusChange?.("error", "Connection closed unexpectedly");
            }
        };

        return () => {
            ws.close();
        };
    }, [onStatusChange]);

    return (
        <div className="w-full h-full overflow-hidden bg-black flex items-center justify-center">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ objectFit: "contain" }}
            />
        </div>
    );
}
