import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.estimation_service import (
    current_eva_battery_time_remaining,
    current_eva_oxygen_time_remaining,
    current_rover_battery_time_remaining,
    current_rover_oxygen_time_remaining,
)

router = APIRouter()


@router.get("/estimation/time_remaining")
async def get_time_remaining():
    rover_battery, rover_oxygen, eva_battery, eva_oxygen = await asyncio.gather(
        current_rover_battery_time_remaining(),
        current_rover_oxygen_time_remaining(),
        current_eva_battery_time_remaining(),
        current_eva_oxygen_time_remaining(),
    )
    return JSONResponse(
        {
            "rover_battery_time_remaining_s": rover_battery,
            "rover_oxygen_time_remaining_s": rover_oxygen,
            "eva_battery_time_remaining_s": eva_battery,
            "eva_oxygen_time_remaining_s": eva_oxygen,
        }
    )
