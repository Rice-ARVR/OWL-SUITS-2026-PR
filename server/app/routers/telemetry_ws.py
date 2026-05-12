from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.telemetry.telemetry_ws_service import manager

router = APIRouter()


@router.websocket("/ws/telemetry")
async def telemetry_websocket(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive; client messages ignored
    except WebSocketDisconnect:
        await manager.disconnect(ws)
