"""WebSocket endpoint for streaming vision-based autonomous navigation telemetry."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.telemetry.navigation_telemetry_service import manager

router = APIRouter()


@router.websocket("/ws/navigation/vision")
async def vision_navigation_websocket(ws: WebSocket) -> None:
    """WebSocket endpoint for streaming vision-based autonomous navigation telemetry.

    Clients connect here to receive real-time updates about the rover's autonomous
    driving state, obstacle detection, steering decisions, and health metrics.

    Message format:
    {
        "type": "vision_navigation",
        "data": {
            "timestamp": float,
            "mode": "AVOID" | "CLEAR" | "BOXED",
            "position_x": float,
            "position_y": float,
            "detections": [...],
            ...
        }
    }
    """
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive; client messages ignored
    except WebSocketDisconnect:
        await manager.disconnect(ws)
