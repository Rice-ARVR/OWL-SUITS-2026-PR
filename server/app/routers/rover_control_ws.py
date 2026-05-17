import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.rover_control_request import RoverControlRequest
from app.services.navigation.navigation_service import (
    navigation_state,
    stop_autonomous_loop,
)
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

                # --- EMERGENCY OVERRIDE INTERCEPTOR ---
                state = await navigation_state.get_snapshot()

                if state.autonomous_driving:
                    # 1. Alert the UI that the driver took over
                    await navigation_state.update_status(
                        "Emergency Override: Autonomy aborted by manual input.",
                        "warning",
                    )
                    # 2. Kill the autonomous navigation WITHOUT slamming the brakes
                    # so the rover's momentum seamlessly blends into the user's input.
                    await stop_autonomous_loop(apply_brakes=False)
                # --------------------------------------

                # Forward the human's command to the TSS
                await send_rover_command(cmd.model_dump(exclude_unset=True))

                await ws.send_text(json.dumps({"status": "ok"}))

            except (ValidationError, ValueError) as e:
                await ws.send_text(json.dumps({"status": "error", "detail": str(e)}))

    except WebSocketDisconnect:
        pass
