from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated
from app.services.rover_control_service import send_rover_command

router = APIRouter()


class RoverControlRequest(BaseModel):
    throttle: Annotated[float, Field(ge=-100.0, le=100.0)] = 0.0
    steering: Annotated[float, Field(ge=-1.0, le=1.0)] = 0.0
    brakes: Annotated[float, Field(ge=0.0, le=1.0)] = 0.0


@router.post("/rover/control")
async def control_rover(cmd: RoverControlRequest):
    try:
        await send_rover_command(cmd.model_dump())
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
