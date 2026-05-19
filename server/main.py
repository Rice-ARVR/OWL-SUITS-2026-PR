import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import connect, disconnect
from app.routers import systems_actions
from app.routers.dust_cv_ws import router as dust_cv_ws_router
from app.routers.estimation import router as estimation_router
from app.routers.locations import router as locations_router
from app.routers.navigation import router as navigation_router
from app.routers.ollama import router as ollama_router
from app.routers.procedures import router as procedures_router
from app.routers.rover_control_ws import router as rover_control_ws_router
from app.routers.speech import router as speech_router
from app.routers.telemetry_ws import router as telemetry_ws_router
from app.routers.tss_example import router as tss_example_router
from app.routers.warnings import router as warnings_router
from app.services.navigation.dust_stream_service import start as start_dust_stream
from app.services.navigation.dust_stream_service import stop as stop_dust_stream
from app.services.navigation.vision.cv_service import start as start_cv_service
from app.services.navigation.vision.cv_service import stop as stop_cv_service
from app.services.navigation.vision.cv_stream_service import start as start_cv_stream
from app.services.navigation.vision.cv_stream_service import stop as stop_cv_stream
from app.services.rag.document_service import ingest_documents
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
    try:
        connect()
    except Exception as e:
        logger.warning("MongoDB unavailable, continuing without DB: %s", e)

    await ingest_documents(force=True)
    # await warmup_model(settings.AIA_MODEL)
    await start_polling()
    await start_dust_stream()
    await start_cv_service()
    await start_cv_stream()
    yield
    await stop_cv_stream()
    await stop_cv_service()
    await stop_dust_stream()
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
app.include_router(estimation_router)
app.include_router(ollama_router)
app.include_router(speech_router)
app.include_router(tss_example_router)
app.include_router(locations_router)
app.include_router(warnings_router)
app.include_router(telemetry_ws_router)
app.include_router(rover_control_ws_router)
app.include_router(navigation_router)
app.include_router(dust_cv_ws_router)
app.include_router(procedures_router)
app.include_router(systems_actions.router)
