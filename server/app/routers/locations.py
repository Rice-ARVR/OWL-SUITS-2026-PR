from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.locations_service import get_rover_location, get_eva_locations

router = APIRouter()


@router.get("/locations/rover")
async def get_rover_current_location():
    data = await get_rover_location()
    return JSONResponse(data)


@router.get("/locations/eva")
async def get_eva_current_locations():
    data = await get_eva_locations()
    return JSONResponse(data)