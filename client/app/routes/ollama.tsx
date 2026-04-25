import { useEffect, useRef, useState } from "react";
import { useOllama } from "~/hooks/useOllama";

export function meta() {
    return [
        { title: "Local LLM Chat" },
        { name: "description", content: "Chat with Ollama (local LLM)" },
    ];
}

export default function OllamaPage() {
    const [input, setInput] = useState("");
    const { chat, messages, loading, error, connected, clearHistory } = useOllama("llama3.2");
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
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;
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
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px", display: "flex", flexDirection: "column", height: "90vh" }}>
            <h1>Local LLM Chat</h1>
            <p style={{ marginBottom: 4, fontSize: 13 }}>
                Server→Ollama:{" "}
                {health === null
                    ? "checking..."
                    : health.ok
                      ? `ok (${health.ollama_url}, models: ${health.models.length})`
                      : `error (${health.ollama_url}): ${health.error}`}
            </p>
            <p style={{ marginBottom: 8, fontSize: 13 }}>
                LLM:{" "}
                {connected === null
                    ? "unknown (no requests yet)"
                    : connected
                      ? "online"
                      : "offline / unreachable"}
            </p>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #ccc", borderRadius: 6, padding: 12, marginBottom: 8 }}>
                {messages.length === 0 && (
                    <p style={{ color: "#888", fontSize: 14 }}>Ask something about the current mission telemetry...</p>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        style={{
                            marginBottom: 12,
                            textAlign: msg.role === "user" ? "right" : "left",
                        }}
                    >
                        <span
                            style={{
                                display: "inline-block",
                                background: msg.role === "user" ? "#0078d4" : "#f0f0f0",
                                color: msg.role === "user" ? "#fff" : "#000",
                                borderRadius: 8,
                                padding: "8px 12px",
                                maxWidth: "85%",
                                whiteSpace: "pre-wrap",
                                fontSize: 14,
                                textAlign: "left",
                            }}
                        >
                            {msg.content || <span style={{ color: "#aaa" }}>▍</span>}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {error && <p style={{ color: "red", fontSize: 13, marginBottom: 4 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
                <textarea
                    rows={3}
                    style={{ flex: 1, resize: "none" }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask something... (Enter to send, Shift+Enter for newline)"
                    disabled={loading}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button onClick={handleSend} disabled={loading || !input.trim()} style={{ flex: 1 }}>
                        {loading ? "..." : "Send"}
                    </button>
                    <button onClick={clearHistory} disabled={loading} style={{ fontSize: 12 }}>
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
}
