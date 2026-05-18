import { useCallback, useEffect, useRef } from "react";

const MEDIAMTX_URL = import.meta.env.VITE_MEDIAMTX_URL ?? "http://localhost:8889";
const STREAM_NAME = import.meta.env.VITE_STREAM_NAME ?? "live";

export type StreamStatus = "idle" | "connecting" | "live" | "error";

interface StreamViewProps {
    onStatusChange?: (status: StreamStatus, error?: string) => void;
}

export default function StreamView({ onStatusChange }: StreamViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const connect = useCallback(async () => {
        pcRef.current?.close();
        onStatusChange?.("connecting");

        const pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });

        pc.addEventListener("track", (event) => {
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
        });

        pc.addEventListener("connectionstatechange", () => {
            if (pc.connectionState === "connected") {
                onStatusChange?.("live");
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                onStatusChange?.("error", "Stream connection lost");
            }
        });

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const res = await fetch(`${MEDIAMTX_URL}/${STREAM_NAME}/whep`, {
                method: "POST",
                headers: { "Content-Type": "application/sdp" },
                body: offer.sdp,
            });

            if (!res.ok) {
                throw new Error(`WHEP ${res.status}: ${await res.text()}`);
            }

            await pc.setRemoteDescription({
                type: "answer",
                sdp: await res.text(),
            });
        } catch (err) {
            onStatusChange?.("error", err instanceof Error ? err.message : "Connection failed");
            pc.close();
        }
    }, [onStatusChange]);

    useEffect(() => {
        connect();
        return () => {
            pcRef.current?.close();
        };
    }, [connect]);

    return (
        <div className="w-full h-full overflow-hidden bg-black">
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                // add these:
                disablePictureInPicture
                disableRemotePlayback
                className="w-full h-full object-cover"
                style={{ objectFit: "cover" }}
            />
        </div>
    );
}
