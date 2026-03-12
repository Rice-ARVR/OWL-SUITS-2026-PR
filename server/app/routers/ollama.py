import json

import logging
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class GenerateRequest(BaseModel):
    model: str = "llama3.2"
    prompt: str
    stream: bool = True


@router.get("/ollama/health")
async def health():
    """Check whether the server can reach Ollama."""
    tags_url = f"{settings.OLLAMA_URL.rstrip('/')}/api/tags"
    logger.info("Ollama health check: GET %s", tags_url)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(tags_url)
            r.raise_for_status()
            data = r.json()
            return JSONResponse(
                {
                    "ok": True,
                    "ollama_url": settings.OLLAMA_URL,
                    "models": data.get("models", []),
                }
            )
    except Exception as e:
        logger.exception("Ollama health check failed: %s", e)
        return JSONResponse(
            {
                "ok": False,
                "ollama_url": settings.OLLAMA_URL,
                "error": str(e),
            },
            status_code=503,
        )


@router.post("/ollama/generate")
async def generate(request: GenerateRequest):
    """Proxy to Ollama /api/generate with optional streaming."""
    url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"
    payload = {
        "model": request.model,
        "prompt": request.prompt,
        "stream": request.stream,
    }
    logger.info(
        "Ollama generate: POST %s model=%s prompt_len=%s stream=%s",
        url,
        request.model,
        len(request.prompt),
        request.stream,
    )

    if request.stream:
        async def stream_from_ollama():
            try:
                async with httpx.AsyncClient(timeout=300.0) as client:
                    async with client.stream(
                        "POST",
                        url,
                        json=payload,
                    ) as response:
                        try:
                            response.raise_for_status()
                        except httpx.HTTPStatusError as e:
                            error_payload = {
                                "error": e.response.text
                                or f"HTTP {e.response.status_code} from Ollama",
                            }
                            yield (json.dumps(error_payload) + "\n").encode("utf-8")
                            return
                        async for chunk in response.aiter_bytes():
                            yield chunk
            except httpx.ConnectError:
                logger.exception("Ollama connect error: POST %s", url)
                error_payload = {
                    "error": "Cannot connect to Ollama. Is it running?",
                }
                yield (json.dumps(error_payload) + "\n").encode("utf-8")

        return StreamingResponse(
            stream_from_ollama(),
            media_type="application/x-ndjson",
        )

    # Non-streaming: proxy and return full body
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return JSONResponse(r.json())
        except httpx.ConnectError as e:
            raise HTTPException(
                status_code=503,
                detail="Cannot connect to Ollama. Is it running?",
            ) from e
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=e.response.text,
            ) from e
