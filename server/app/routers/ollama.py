import json
import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

url = f"{settings.OLLAMA_URL.rstrip('/')}/api/generate"


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

    try:
        if request.stream:

            async def stream_from_ollama():
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("POST", url, json=payload) as response:
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

            return StreamingResponse(
                stream_from_ollama(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )

        else:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()

            return JSONResponse(
                {
                    "model": request.model,
                    "response": result.get("response", ""),
                    "done": result.get("done", True),
                }
            )

    except Exception as e:
        logger.exception("Ollama generate failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/query")
async def query_model(req: Request):
    data = await req.json()

    model = data.get("model", "llama3.2")
    prompt = data.get("prompt", "")
    stream = data.get("stream", True)

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": stream,
    }

    try:
        if stream:

            async def generate_stream():
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("POST", url, json=payload) as response:
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

            return StreamingResponse(
                generate_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )

        else:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()

            return JSONResponse(result)

    except Exception as e:
        logger.exception("Query model failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)