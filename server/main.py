from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.tss_example import router as tss_example_router
from app.routers.locations import router as locations_router
from app.services.telemetry.telemetry_service import start_polling, stop_polling
from app.db.database import connect, disconnect


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect()
    await start_polling()
    yield
    await stop_polling()
    disconnect()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
)

# Include Routers Here:
app.include_router(tss_example_router)
app.include_router(locations_router)
