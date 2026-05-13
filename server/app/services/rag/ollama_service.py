import json
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import settings
from app.services.rag.rag_service import get_chain, to_lc_messages

logger = logging.getLogger(__name__)

_generate_url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"


async def warmup_model(model: str = "llama3.2") -> None:
    """Load the model into Ollama memory at startup so the first user request is instant."""
    url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"
    payload = {"model": model, "prompt": "hi", "stream": False, "keep_alive": -1, "options": {"num_predict": 1}}
    print(f"[warmup] Loading Ollama model '{model}' at {url} — this may take a minute...", flush=True)
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            await client.post(url, json=payload)
        print(f"[warmup] Ollama model '{model}' is loaded and ready.", flush=True)
    except Exception as e:
        print(f"[warmup] WARNING: Ollama warmup failed (server will still start): {e}", flush=True)


async def check_ollama_health() -> dict:
    """Ping the Ollama /api/tags endpoint and return status and available models."""
    tags_url = f"{settings.OLLAMA_URL.rstrip('/')}/api/tags"
    logger.info("Ollama health check: GET %s", tags_url)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(tags_url)
            r.raise_for_status()
            data = r.json()
        return {
            "ok": True,
            "ollama_url": settings.OLLAMA_URL,
            "models": data.get("models", []),
        }
    except Exception as e:
        logger.exception("Ollama health check failed: %s", e)
        return {"ok": False, "ollama_url": settings.OLLAMA_URL, "error": str(e)}


async def stream_rag(
    model: str, question: str, chat_history: list[dict], use_rag: bool = True
) -> AsyncGenerator[str, None]:
    chain_input = {"question": question, "chat_history": to_lc_messages(chat_history)}
    async for chunk in get_chain(use_rag).astream(chain_input):
        yield f"data: {json.dumps({'response': chunk})}\n\n"
    yield "data: [DONE]\n\n"


async def invoke_rag(model: str, question: str, chat_history: list[dict], use_rag: bool = True) -> str:
    chain_input = {"question": question, "chat_history": to_lc_messages(chat_history)}
    return await get_chain(use_rag).ainvoke(chain_input)


async def stream_generate(payload: dict) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", _generate_url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        yield f"data: {json.dumps(chunk)}\n\n"
                        if chunk.get("done", False):
                            yield "data: [DONE]\n\n"
                            break
                    except json.JSONDecodeError:
                        continue


async def generate_response(payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(_generate_url, json=payload)
        response.raise_for_status()
        result = response.json()
    return {
        "model": payload["model"],
        "response": result.get("response", ""),
        "done": result.get("done", True),
    }
