from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.example.tss_example_service import get_tss_example

router = APIRouter()


@router.get("/tss_example")
async def tss_example():
    data = await get_tss_example()
    return JSONResponse(data)
