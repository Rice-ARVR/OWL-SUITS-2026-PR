import { useState } from "react";
import type { AIAWidgetData } from "../types/aiaWidgets";

export interface Message {
    role: "user" | "assistant";
    content: string;
    widgets?: AIAWidgetData[];
    hidden?: boolean;
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function cleanAssistantText(text: string) {
    return text
        .replace(/\[(EVA|ROVER|LTV|LTV_ERRORS)\]\s*/gi, "")
        .replace(/^EVA section:\s*/gi, "")
        .replace(/^ROVER section:\s*/gi, "")
        .replace(/^LTV section:\s*/gi, "")
        .trim();
}

export function useOllama() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState<boolean | null>(null);

    const chat = async (prompt: string, options?: { hidden?: boolean; suppressWidgetTypes?: string[] }) => {
        setLoading(true);
        setError(null);

        // Snapshot history before this turn, then immediately show the user message
        const historyToSend = [...messages];
        setMessages((prev) => [...prev, { role: "user", content: prompt, hidden: options?.hidden }]);

        let fullResponse = "";

        try {
            const res = await fetch(`${apiUrl}/ollama/rag-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: prompt,
                    stream: true,
                    chat_history: historyToSend,
                    use_rag: true,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                try {
                    const json = JSON.parse(text) as { detail?: string; error?: string };
                    const message = json.detail ?? json.error ?? text;
                    throw new Error(message || `HTTP ${res.status}`);
                } catch {
                    throw new Error(text || `HTTP ${res.status}`);
                }
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            // Append an empty assistant bubble to stream tokens into
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line || !line.startsWith("data: ")) continue;

                    const data = line.slice(6).trim();
                    if (data === "[DONE]") break;

                    try {
                        const parsed = JSON.parse(data) as {
                            response?: string;
                            widgets?: AIAWidgetData[];
                            error?: string;
                        };

                        if (parsed.error) {
                            setError(parsed.error);
                            setConnected(false);
                            continue;
                        }

                        if (parsed.response) {
                            fullResponse += parsed.response;
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: "assistant",
                                    content: cleanAssistantText(fullResponse),
                                    widgets: (parsed.widgets ?? []).filter(
                                        (w) => !options?.suppressWidgetTypes?.includes(w.type),
                                    ),
                                };
                                return updated;
                            });
                            setConnected(true);
                        }
                    } catch (e) {
                        console.error("Failed to parse SSE JSON:", data, e);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect to Ollama");
            setConnected(false);
            // Drop the empty assistant bubble if nothing was received
            if (!fullResponse) {
                setMessages((prev) => prev.slice(0, -1));
            }
        } finally {
            setLoading(false);
        }
    };

    const clearHistory = () => setMessages([]);

    return { chat, messages, loading, error, connected, clearHistory };
}
