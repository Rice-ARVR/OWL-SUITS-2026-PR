import { useEffect, useState } from "react";
import { useOllama } from "~/hooks/useOllama";

export function meta() {
  return [
    { title: "Local LLM Chat" },
    { name: "description", content: "Chat with Ollama (local LLM)" },
  ];
}

export default function OllamaPage() {
  const [input, setInput] = useState("");
  const { chat, response, loading, error, connected } = useOllama("llama3.2");
  const [health, setHealth] = useState<
    | { ok: true; ollama_url: string; models: unknown[] }
    | { ok: false; ollama_url: string; error: string }
    | null
  >(null);

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
        })
      );
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px" }}>
      <h1>Local LLM Chat</h1>
      <p style={{ marginBottom: 8, fontSize: 14 }}>
        Server→Ollama:{" "}
        {health === null
          ? "checking..."
          : health.ok
          ? `ok (${health.ollama_url}, models: ${health.models.length})`
          : `error (${health.ollama_url}): ${health.error}`}
      </p>
      <p style={{ marginBottom: 8, fontSize: 14 }}>
        LLM status:{" "}
        {connected === null
          ? "unknown (no requests yet)"
          : connected
          ? "online"
          : "offline / unreachable"}
      </p>
      <textarea
        rows={4}
        style={{ width: "100%" }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask something..."
      />
      <button onClick={() => chat(input)} disabled={loading}>
        {loading ? "Thinking..." : "Send"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {response && (
        <pre style={{ whiteSpace: "pre-wrap" }}>{response}</pre>
      )}
    </div>
  );
}
