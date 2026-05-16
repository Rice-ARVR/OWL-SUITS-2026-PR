from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.locations_service import (
    get_rover_location,
    get_eva_locations,
    get_ltv_location,
    get_hazards,
    get_waypoints,
    get_ltv_search_radius,
    get_best_path_routing,
)

router = APIRouter()


@router.get("/locations/rover")
async def get_rover_current_location():
    data = await get_rover_location()
    return JSONResponse(data)


@router.get("/locations/eva")
async def get_eva_current_locations():
    data = await get_eva_locations()
    return JSONResponse(data)


@router.get("/locations/ltv")
async def get_ltv_current_location():
    data = await get_ltv_location()
    return JSONResponse(data)


@router.get("/locations/hazards")
async def get_terrain_hazards():
    data = await get_hazards()
    return JSONResponse(data)


@router.get("/locations/waypoints")
async def get_mission_waypoints():
    data = await get_waypoints()
    return JSONResponse(data)


@router.get("/locations/recommended-path")
async def get_ai_recommended_path():
    data = await get_best_path_routing()
    return JSONResponse(data)


@router.get("/locations/ltv-search-radius")
async def get_ltv_search_radius_endpoint():
    data = await get_ltv_search_radius()
    return JSONResponse(data)
