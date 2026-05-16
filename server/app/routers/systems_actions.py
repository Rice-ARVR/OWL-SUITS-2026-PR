import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.rover_control_service import send_rover_command

logger = logging.getLogger(__name__)
router = APIRouter()


class SystemActionRequest(BaseModel):
    action: str
    target: str | None = None
    value: str | int | float | bool | None = None


@router.post("/system/action")
async def system_action(request: SystemActionRequest) -> dict[str, Any]:
    payload = request.model_dump()
    logger.info("System action received: %s", payload)

    if request.action == "cancel":
        return {
            "ok": True,
            "message": "Action cancelled.",
            "received": payload,
        }

    message = "System action received."

    if request.action == "turn_on" and request.target == "fan_heating":
        await send_rover_command({"cabin_heating": True})
        message = "Fan heating turned on."

    elif request.action == "turn_off" and request.target == "fan_heating":
        await send_rover_command({"cabin_heating": False})
        message = "Fan heating turned off."

    elif request.action == "reduce_speed":
        await send_rover_command({"throttle": 0})
        message = "Rover speed reduced."

    elif request.action == "hold_position":
        await send_rover_command({"throttle": 0, "brakes": True})
        message = "Rover holding position."

    elif request.action == "switch_backup_power":
        message = "Backup power switch requested."

    elif request.action == "check_oxygen_system":
        message = "Oxygen system check requested."

    elif request.action == "check_coolant_system":
        message = "Coolant system check requested."

    elif request.action == "check_pressure_system":
        message = "Pressure system check requested."

    elif request.action == "check_fan_system":
        message = "Fan system check requested."

    elif request.action == "check_scrubber_system":
        message = "Scrubber system check requested."

    elif request.action == "check_signal":
        message = "Signal check requested."

    elif request.action == "review_thermal_status":
        message = "Thermal status review requested."

    elif request.action == "review_telemetry":
        message = "Telemetry review requested."

    elif request.action == "run_diagnostics":
        message = "Diagnostics requested."

    else:
        return {
            "ok": False,
            "message": "Unknown system action.",
            "received": payload,
        }

    logger.info("%s Target=%s Value=%s", message, request.target, request.value)

    return {
        "ok": True,
        "message": message,
        "received": payload,
    }
