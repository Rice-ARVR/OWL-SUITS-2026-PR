"""WebSocket endpoint for streaming vision-based autonomous navigation telemetry."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.telemetry.navigation_telemetry_service import manager

router = APIRouter()


@router.websocket("/ws/navigation/vision")
async def vision_navigation_websocket(ws: WebSocket) -> None:
    """WebSocket endpoint for streaming vision-based autonomous navigation UI updates.

    Clients connect here to receive real-time, pre-formatted text updates about the
    rover's autonomous driving state, obstacle detection, steering decisions, and
    health metrics.

    Note: To conserve bandwidth and rendering cycles, messages are ONLY broadcast
    when the rover's tactical state visibly changes, rather than continuously at a
    fixed tick rate. The WebSocket may sit quiet during straight-line driving.

    Message format:
    {
        "type": "vision_navigation",
        "data": {
            "mode": str,      # e.g., "🟡 Mode: AVOID (Evasive Maneuver)"
            "threat": str,    # e.g., "Path: Flank Obstacle Detected (Danger Score: 0.45)"
            "steering": str,  # e.g., "Steering: -0.65 (Evasion: -0.80 | Goal: +0.20)"
            "throttle": str,  # e.g., "Throttle: SLOW (30.0%) - Correction Maneuver"
            "health": str     # e.g., "Status: Nominal"
        }
    }
    """
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive; client messages ignored
    except WebSocketDisconnect:
        await manager.disconnect(ws)
