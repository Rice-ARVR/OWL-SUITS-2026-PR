import { useRef, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useVoice() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Request mic access, set up MediaRecorder, and begin capturing audio chunks
    const startRecording = async () => {
        setVoiceError(null);
        setTranscript(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            // release mic before uploading
            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                await sendAudio(blob, recorder.mimeType);
            };
            recorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (e) {
            setVoiceError(e instanceof Error ? e.message : "Microphone access denied");
        }
    };

    // Stop the active recorder; onstop handler will then upload the collected chunks
    const stopRecording = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsRecording(false);
    };

    // Upload the recorded blob to the transcription endpoint and store the result
    const sendAudio = async (blob: Blob, mimeType: string) => {
        setTranscribing(true);
        try {
            // Whisper requires a file extension; derive it from the browser's reported MIME type
            const ext = mimeType.includes("ogg")
                ? "ogg"
                : mimeType.includes("mp4")
                  ? "mp4"
                  : "webm";
            const formData = new FormData();
            formData.append("file", blob, `recording.${ext}`);
            const res = await fetch(`${apiUrl}/speech/transcribe`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(data.error ?? `HTTP ${res.status}`);
            }
            const data = (await res.json()) as { transcript?: string };
            setTranscript(data.transcript ?? "");
        } catch (e) {
            setVoiceError(e instanceof Error ? e.message : "Transcription failed");
        } finally {
            setTranscribing(false);
        }
    };

    return { isRecording, transcribing, transcript, voiceError, startRecording, stopRecording };
}
