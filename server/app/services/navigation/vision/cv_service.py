import asyncio
import logging

import app.services.navigation.dust_stream_service as dust_stream
from app.core.ws_manager import WebSocketManager

logger = logging.getLogger(__name__)

manager = WebSocketManager()

_task: asyncio.Task | None = None


async def _process_loop() -> None:
    q = await dust_stream.subscribe()
    try:
        while True:
            frame: bytes = await q.get()
            # Pass-through: broadcast raw JPEG to connected clients.
            # Replace this with CV processing (YOLO, segmentation, etc.) later.
            if manager._clients:
                await manager.broadcast_bytes(frame)
    except asyncio.CancelledError:
        raise
    finally:
        await dust_stream.unsubscribe(q)


async def start() -> None:
    global _task
    _task = asyncio.create_task(_process_loop(), name="cv_service")
    logger.info("CV service started")


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
        logger.info("CV service stopped")