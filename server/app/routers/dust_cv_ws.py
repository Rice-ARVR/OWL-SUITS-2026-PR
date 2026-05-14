from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.navigation.vision.cv_service import manager

router = APIRouter()


@router.websocket("/ws/dust-cv")
async def dust_cv_websocket(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive; client messages ignored
    except WebSocketDisconnect:
        await manager.disconnect(ws)