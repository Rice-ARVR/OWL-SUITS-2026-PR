from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.tss_example import router as tss_example_router
from app.routers.locations import router as locations_router
from app.routers.warnings import router as warnings_router
<<<<<<< HEAD
from app.routers.rover_control import router as rover_control_router
=======
>>>>>>> 29c0ad7a275e5dcef28b1acd66d68441b29e08d4
from app.routers.vital_signs import router as vital_signs_router
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
    allow_methods=["GET", "POST"],
)

# Include Routers Here:
app.include_router(tss_example_router)
app.include_router(locations_router)
app.include_router(warnings_router)
<<<<<<< HEAD
app.include_router(rover_control_router)
=======
>>>>>>> 29c0ad7a275e5dcef28b1acd66d68441b29e08d4
app.include_router(vital_signs_router)
