import json
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import settings
from app.services.rag.rag_service import build_rag_chain

logger = logging.getLogger(__name__)

_generate_url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"


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
    model: str, question: str, chat_history: list[dict]
) -> AsyncGenerator[str, None]:
    chain = build_rag_chain(model, chat_history)
    async for chunk in chain.astream(question):
        yield f"data: {json.dumps({'response': chunk})}\n\n"
    yield "data: [DONE]\n\n"


async def invoke_rag(model: str, question: str, chat_history: list[dict]) -> str:
    chain = build_rag_chain(model, chat_history)
    return await chain.ainvoke(question)


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
