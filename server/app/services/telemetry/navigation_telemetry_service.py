"""WebSocket broadcast service for vision-based autonomous navigation telemetry.

Manages client connections and broadcasts UI updates to frontend clients
only when the rover's tactical state visually changes.
"""

import json
import logging
from typing import Optional

from app.core.ws_manager import WebSocketManager
from app.models.navigation_telemetry import VisionTelemetry

logger = logging.getLogger(__name__)

manager = WebSocketManager()

# Global state cache to track the last sent messages
_last_ui_messages: Optional[dict] = None


async def broadcast_navigation_telemetry(snapshot: VisionTelemetry) -> None:
    """Broadcast telemetry UI strings ONLY if they have changed since the last tick.

    Args:
        snapshot: VisionTelemetry dataclass with current autonomous drive state.
    """
    global _last_ui_messages

    try:
        # Extract purely the 5 formatted strings we built in the dataclass
        # (snapshot.to_dict() now maps directly to get_ui_messages())
        current_ui_messages = snapshot.to_dict()

        # STATE-DIFF CHECK: If nothing has changed visually, drop the message entirely
        if current_ui_messages == _last_ui_messages:
            return

        # Update our cache to the new state
        _last_ui_messages = current_ui_messages

        # Build the ultra-lean payload containing ONLY the strings
        payload = {
            "type": "vision_navigation",
            "data": current_ui_messages,
        }

        await manager.broadcast(json.dumps(payload))

    except Exception as e:
        logger.error("Failed to broadcast navigation telemetry: %s", e)
