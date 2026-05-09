import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.rover_control_request import RoverControlRequest
from app.services.rover_control_service import send_rover_command

router = APIRouter()


@router.websocket("/ws/rover/control")
async def rover_control_websocket(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                cmd = RoverControlRequest.model_validate(json.loads(raw))
                await send_rover_command(cmd.model_dump(exclude_unset=True))
                await ws.send_text(json.dumps({"status": "ok"}))
            except (ValidationError, ValueError) as e:
                await ws.send_text(json.dumps({"status": "error", "detail": str(e)}))
    except WebSocketDisconnect:
        pass
