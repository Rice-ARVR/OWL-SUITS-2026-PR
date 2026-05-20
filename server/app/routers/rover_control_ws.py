import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.nav_model import SearchPhase  # <--- Added Import
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

                # Emergency override interceptor
                state = await navigation_state.get_snapshot()

                if state.autonomous_driving:
                    # Phase 2 (concentric triangle) must complete all 3 waypoints —
                    # manual override is blocked so triangulation data stays valid.
                    if state.session and state.session.phase == SearchPhase.CONCENTRIC_SEARCH:
                        await navigation_state.update_status(
                            "Manual input ignored: triangle scan must complete all 3 waypoints.",
                            "warning",
                        )
                        continue

                    # 1. Alert the UI
                    await navigation_state.update_status(
                        "Emergency Override: Autonomy aborted by manual input.",
                        "warning",
                    )

                    # 2. Formally "Pause" the session so it can resume cleanly later
                    if state.session:
                        state.session.previous_phase = state.session.phase
                        state.session.phase = SearchPhase.IDLE
                        state.session.current_target = None
                        state.session.projected_path = []
                        await navigation_state.update_session(state.session)

                    # 3. Kill the autonomous driving without brakes
                    await stop_autonomous_loop(apply_brakes=False)

                # Forward the human's command to the TSS
                await send_rover_command(cmd.model_dump(exclude_unset=True))

                await ws.send_text(json.dumps({"status": "ok"}))

            except (ValidationError, ValueError) as e:
                await ws.send_text(json.dumps({"status": "error", "detail": str(e)}))

    except WebSocketDisconnect:
        pass
