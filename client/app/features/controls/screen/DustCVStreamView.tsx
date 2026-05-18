import { useEffect, useRef } from "react";

export type StreamStatus = "idle" | "connecting" | "live" | "error";

interface DustCVStreamViewProps {
    onStatusChange?: (status: StreamStatus, error?: string) => void;
}

export default function DustCVStreamView({ onStatusChange }: DustCVStreamViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const apiUrl = "http://localhost:8000";
        const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/dust-cv";

        onStatusChange?.("connecting");

        const ws = new WebSocket(wsUrl);
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
        <div
            className="w-full h-full overflow-hidden bg-black flex items-center justify-center"
            style={{ borderRadius: "10px", border: "4px solid #3a3a41" }}
        >
            <canvas ref={canvasRef} className="w-full h-full" style={{ objectFit: "contain" }} />
        </div>
    );
}
