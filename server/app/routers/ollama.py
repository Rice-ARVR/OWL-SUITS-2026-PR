import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.rag.document_service import ingest_documents
from app.services.rag.ollama_service import (
    check_ollama_health,
    generate_response,
    invoke_rag,
    stream_generate,
    stream_rag,
)
from app.services.rag.rag_service import get_raw_context

logger = logging.getLogger(__name__)
router = APIRouter()


##################
## Setup Routes ##
##################


@router.get("/ollama/health")
async def health():
    """Check whether the server can reach Ollama."""
    result = await check_ollama_health()
    return JSONResponse(result, status_code=200 if result["ok"] else 503)


################
## AIA Routes ##
################


class GenerateRequest(BaseModel):
    model: str = "llama3.2"
    prompt: str
    stream: bool = True


class Message(BaseModel):
    role: str
    content: str


class RagQueryRequest(BaseModel):
    model: str = "llama3.2"
    question: str
    stream: bool = True
    chat_history: list[Message] = []


@router.post("/ollama/rag-query")
async def rag_query(request: RagQueryRequest):
    """Ask a question answered using live TSS telemetry + retrieved mission documents."""
    logger.info(
        "Ollama rag-query: model=%s question_len=%d stream=%s",
        request.model,
        len(request.question),
        request.stream,
    )
    try:
        history = [m.model_dump() for m in request.chat_history]
        if request.stream:
            return StreamingResponse(
                stream_rag(request.model, request.question, history),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )
        result = await invoke_rag(request.model, request.question, history)
        return JSONResponse({"model": request.model, "response": result, "done": True})
    except Exception as e:
        logger.exception("Ollama rag-query failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/ollama/generate")
async def generate(request: GenerateRequest):
    """Proxy to Ollama /api/generate with optional streaming."""
    payload = {
        "model": request.model,
        "prompt": request.prompt,
        "stream": request.stream,
    }
    logger.info(
        "Ollama generate: model=%s prompt_len=%s stream=%s",
        request.model,
        len(request.prompt),
        request.stream,
    )
    try:
        if request.stream:
            return StreamingResponse(
                stream_generate(payload),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )
        result = await generate_response(payload)
        return JSONResponse(result)
    except Exception as e:
        logger.exception("Ollama generate failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


#####################
## Debugging Tools ##
#####################


@router.get("/ollama/rag-context")
async def rag_context():
    """Returns the current TSS context that will be injected into RAG queries. Use for debugging."""
    return JSONResponse({"context": get_raw_context()})


@router.post("/ollama/ingest")
async def ingest(force: bool = False):
    """
    Ingest documents from the server/documents/ directory into the Chroma vector store.
    Supports .pdf and .txt files. Pass ?force=true to wipe and re-index from scratch.
    """
    try:
        result = await ingest_documents(force=force)
        return JSONResponse(result)
    except Exception as e:
        logger.exception("Document ingestion failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)
