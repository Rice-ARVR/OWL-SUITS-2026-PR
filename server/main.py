import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import connect, disconnect
from app.routers.locations import router as locations_router
from app.routers.procedures import router as procedures_router
from app.routers.navigation import router as navigation_router
from app.routers.ollama import router as ollama_router
from app.routers.rover_control import router as rover_control_router
from app.routers.speech import router as speech_router
from app.routers.telemetry_ws import router as telemetry_ws_router
from app.routers.tss_example import router as tss_example_router
from app.routers.warnings import router as warnings_router
from app.services.rag.document_service import ingest_documents
from app.services.rag.ollama_service import warmup_model
from app.services.telemetry.telemetry_service import start_polling, stop_polling
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import BaseRoute

logger = logging.getLogger(__name__)


# Starts TSS Polling
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OLLAMA_URL=%s", settings.OLLAMA_URL)
    # Log what methods are registered for Ollama endpoints.
    for route in app.router.routes:
        if not isinstance(route, BaseRoute):
            continue
        path = getattr(route, "path", None)
        if isinstance(path, str) and path.startswith("/ollama"):
            methods = sorted(getattr(route, "methods", []) or [])
            logger.info("Route registered: %s methods=%s", path, methods)
    connect()
    await start_polling()
    await ingest_documents()
    await warmup_model(settings.AIA_MODEL)
    yield
    await stop_polling()
    disconnect()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*", "POST"],
)

# Include Routers Here:
app.include_router(ollama_router)
app.include_router(speech_router)
app.include_router(tss_example_router)
app.include_router(locations_router)
app.include_router(warnings_router)
app.include_router(telemetry_ws_router)
app.include_router(rover_control_router)
app.include_router(navigation_router)
app.include_router(procedures_router)
