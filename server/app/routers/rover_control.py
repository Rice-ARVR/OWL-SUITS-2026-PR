from fastapi import APIRouter, HTTPException
from app.models.rover_control_request import RoverControlRequest
from app.services.rover_control_service import send_rover_command

router = APIRouter()


@router.post("/rover/control")
async def control_rover(cmd: RoverControlRequest):
    try:
        await send_rover_command(cmd.model_dump())
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
