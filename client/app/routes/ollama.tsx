import { AiaChat } from "~/features/aia/aia";

export function meta() {
    return [
        { title: "Local LLM Chat" },
        { name: "description", content: "Chat with Ollama (local LLM)" },
    ];
}

export default function OllamaPage() {
    return <AiaChat />;
}
