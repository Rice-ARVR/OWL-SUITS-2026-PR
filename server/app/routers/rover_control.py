from fastapi import APIRouter, HTTPException
from app.models.rover_control_request import RoverControlRequest
from app.services.rover_control_service import send_rover_command
import app.services.telemetry.telemetry_service as telemetry_service  # DEBUG: TSS echo check

router = APIRouter()


@router.post("/rover/control")
async def control_rover(cmd: RoverControlRequest):
    try:
        await send_rover_command(cmd.model_dump(exclude_unset=True))
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- DEBUG: TSS echo check — remove when done testing ---
@router.get("/rover/state")
async def get_rover_state():
    return {
        "throttle": await telemetry_service.rover_data.get_pr_throttle(),
        "steering": await telemetry_service.rover_data.get_pr_steering(),
        "brakes": await telemetry_service.rover_data.get_pr_brakes(),
    }
# --- END DEBUG ---
