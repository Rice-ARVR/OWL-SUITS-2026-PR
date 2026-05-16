import { useEffect, useRef, useState } from "react";
import { useOllama } from "~/hooks/useOllama";
import { useVoice } from "~/hooks/useVoice";
import styles from "./aia.module.css";
import MessageBubble from "./components/MessageBubble";
import SystemActionWidget from "./widgets/SystemActionWidget";

function TypingDots() {
    return (
        <span className={styles.typingDots}>
            <span />
            <span />
            <span />
        </span>
    );
}

export function AiaChat() {
    const [input, setInput] = useState("");

    const [dismissedActionId, setDismissedActionId] = useState<string | null>(null);

    const { chat, messages, loading, error, connected, clearHistory } = useOllama();

    const { isRecording, transcribing, transcript, voiceError, startRecording, stopRecording } =
        useVoice();

    const [health, setHealth] = useState<
        | { ok: true; ollama_url: string; models: unknown[] }
        | { ok: false; ollama_url: string; error: string }
        | null
    >(null);

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

        fetch(`${apiUrl}/ollama/health`)
            .then((r) => r.json())
            .then(setHealth)
            .catch((e: unknown) =>
                setHealth({
                    ok: false,
                    ollama_url: apiUrl,
                    error: e instanceof Error ? e.message : "Failed to check health",
                }),
            );
    }, []);

    useEffect(() => {
        if (transcript) setInput(transcript);
    }, [transcript]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const actionWidgets = messages.flatMap(
        (msg) => msg.widgets?.filter((widget) => widget.type === "system_action") ?? [],
    );

    const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");

    const latestActionWidget = latestAssistantMessage?.widgets?.find(
        (widget) => widget.type === "system_action",
    );

    const visibleActionWidget =
        latestActionWidget && latestActionWidget.id !== dismissedActionId
            ? latestActionWidget
            : null;

    async function handleSystemAction(payload: {
        action: string;
        target?: string;
        value?: string | number | boolean;
    }) {
        console.log("System action clicked:", payload);

        try {
            const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

            const response = await fetch(`${apiUrl}/system/action`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            console.log("System action response:", data);
        } catch (err) {
            console.error("Failed to trigger system action:", err);
        }
        setDismissedActionId(latestActionWidget?.id ?? null);

        // Later, connect this to the real backend/system endpoint.
        // Example:
        // fetch(`${apiUrl}/system/action`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(payload),
        // });
    }

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        setDismissedActionId(null);
        setInput("");
        chat(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.messages}>
                {messages.length === 0 && (
                    <p className={styles.emptyState}>
                        Ask something about the current mission telemetry...
                    </p>
                )}

                {messages.map((msg, i) => (
                    <MessageBubble
                        key={i}
                        msg={msg}
                        index={i}
                        fallbackContent={<TypingDots />}
                        onSystemAction={handleSystemAction}
                    />
                ))}

                <div ref={bottomRef} />
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {voiceError && <p className={styles.error}>{voiceError}</p>}

            <div className={styles.inputRow}>
                <textarea
                    rows={3}
                    className={styles.textarea}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything"
                    disabled={loading}
                />

                <div className={styles.actions}>
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className={styles.sendButton}
                    >
                        {loading ? <TypingDots /> : "Send"}
                    </button>

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={loading || transcribing}
                        className={`${styles.micButton} ${
                            isRecording ? styles.micButtonActive : ""
                        }`}
                    >
                        {transcribing ? <TypingDots /> : isRecording ? "■ Stop" : "Mic"}
                    </button>

                    <button
                        onClick={clearHistory}
                        disabled={loading}
                        className={styles.clearButton}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {visibleActionWidget && visibleActionWidget.type === "system_action" && (
                <div className={styles.actionOverlay}>
                    <div className={styles.actionModal}>
                        <SystemActionWidget
                            widget={visibleActionWidget}
                            onAction={handleSystemAction}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
