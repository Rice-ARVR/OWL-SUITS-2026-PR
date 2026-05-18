"""WebSocket broadcast service for vision-based autonomous navigation telemetry.

Manages client connections and broadcasts navigation snapshots to all connected
frontend clients in real-time.
"""

import json
import logging

from app.core.ws_manager import WebSocketManager
from app.models.navigation_telemetry import VisionTelemetry

logger = logging.getLogger(__name__)

manager = WebSocketManager()


async def broadcast_navigation_telemetry(snapshot: VisionTelemetry) -> None:
    """Broadcast a navigation telemetry snapshot to all connected WebSocket clients.

    Args:
        snapshot: VisionTelemetry dataclass with current autonomous drive state.
    """
    try:
        payload = {
            "type": "vision_navigation",
            "data": snapshot.to_dict(),
        }
        await manager.broadcast(json.dumps(payload))
    except Exception as e:
        logger.error("Failed to broadcast navigation telemetry: %s", e)
