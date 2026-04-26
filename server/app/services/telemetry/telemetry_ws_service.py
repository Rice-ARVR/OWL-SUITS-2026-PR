import json

from app.core.ws_manager import WebSocketManager
from app.models.eva import EvaSchema
from app.models.ltv import LtvSchema
from app.models.ltv_errors import LtvErrorsSchema
from app.models.rover import RoverSchema

manager = WebSocketManager()


async def broadcast_snapshot(
    eva: EvaSchema | None,
    rover: RoverSchema | None,
    ltv: LtvSchema | None,
    ltv_errors: LtvErrorsSchema | None,
) -> None:
    if eva is None or rover is None or ltv is None or ltv_errors is None:
        return
    payload = {
        "eva": eva.model_dump(),
        "rover": rover.model_dump(),
        "ltv": ltv.model_dump(),
        "ltv_errors": ltv_errors.model_dump(),
    }
    await manager.broadcast(json.dumps(payload))
