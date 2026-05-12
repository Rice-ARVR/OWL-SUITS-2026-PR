from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.vital_signs_service import get_vital_signs_rover, get_vital_signs_eva

router = APIRouter()


@router.get("/vital_signs/rover")
async def get_rover_vital_signs():
    data = await get_vital_signs_rover()
    return JSONResponse(data)


@router.get("/vital_signs/eva")
async def get_eva_vital_signs():
    data = await get_vital_signs_eva()
    return JSONResponse(data)
