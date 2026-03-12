import { useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useOllama(model = "llama3.2") {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const chat = async (prompt: string) => {
    setLoading(true);
    setResponse("model says: ");
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/ollama/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: true }),
      });

      if (!res.ok) {
        const text = await res.text();
        // Try to parse server error JSON from FastAPI / Ollama proxy
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n").filter(Boolean);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const json = JSON.parse(line) as { response?: string; error?: string };
            if (json.error) {
              setError(json.error);
              setConnected(false);
              continue;
            }
            if (json.response) setResponse((prev) => prev + json.response);
            if (json.response && connected !== true) {
              setConnected(true);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      if (buffer) {
        try {
          const json = JSON.parse(buffer) as { response?: string; error?: string };
          if (json.error) {
            setError(json.error);
            setConnected(false);
            return;
          }
          if (json.response) setResponse((prev) => prev + json.response);
          if (json.response && connected !== true) {
            setConnected(true);
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Ollama");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  console.log("Ollama connection status:", connected);
  console.log("Ollama error:", error);
  console.log("Ollama response:", response);
  return { chat, response, loading, error, connected };
}
