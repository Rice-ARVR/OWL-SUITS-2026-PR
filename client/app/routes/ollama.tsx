import { AiaChat } from "~/features/aia/aia";

export function meta() {
    return [
        { title: "Local LLM Chat" },
        { name: "description", content: "Chat with Ollama (local LLM)" },
    ];
}

export default function OllamaPage() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100vh",
            }}
        >
            <div style={{ width: 500, height: 600 }}>
                <AiaChat />
            </div>
        </div>
    );
}
