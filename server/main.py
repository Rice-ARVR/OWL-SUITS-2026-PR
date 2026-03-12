import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import BaseRoute

from app.routers.ollama import router as ollama_router
from app.routers.tss_example import router as tss_example_router
from app.core.config import settings
from app.services.telemetry.telemetry_service import start_polling, stop_polling


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
    await start_polling()
    yield
    await stop_polling()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Include Routers Here:
app.include_router(ollama_router)
app.include_router(tss_example_router)
