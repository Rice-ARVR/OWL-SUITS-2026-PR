import asyncio
import logging

import cv2
import numpy as np

import app.services.navigation.vision.cv_service as cv_service
from app.core.ws_manager import WebSocketManager

logger = logging.getLogger(__name__)

manager = WebSocketManager()

_task: asyncio.Task | None = None

# BGR tuples
_CLASS_COLORS: dict[str, tuple[int, int, int]] = {
    "Lunar Terrain Vehicle": (0, 255, 0),    # green
    "Boulder":               (0, 0, 255),    # red
    "Crater":                (0, 165, 255),  # orange
    "Lunar Home Base":       (128, 0, 128),  # purple
}
_DEFAULT_COLOR: tuple[int, int, int] = (255, 255, 255)  # white fallback

_FONT = cv2.FONT_HERSHEY_SIMPLEX
_FONT_SCALE = 0.6
_THICKNESS = 2


def _annotate(result: cv_service.CVResult) -> bytes | None:
    annotated = result.frame.copy()
    for det in result.detections:
        x1, y1, x2, y2 = det.bbox
        color = _CLASS_COLORS.get(det.label, _DEFAULT_COLOR)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, _THICKNESS)
        cv2.putText(
            annotated, det.label, (x1, y1 - 8), _FONT, _FONT_SCALE, color, _THICKNESS
        )

    ok, encoded = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return encoded.tobytes() if ok else None


async def _stream_loop() -> None:
    q = await cv_service.subscribe()
    loop = asyncio.get_running_loop()
    try:
        while True:
            result: cv_service.CVResult = await q.get()
            if manager._clients:
                jpeg = await loop.run_in_executor(None, _annotate, result)
                if jpeg is not None:
                    await manager.broadcast_bytes(jpeg)
    except asyncio.CancelledError:
        raise
    finally:
        await cv_service.unsubscribe(q)


async def start() -> None:
    global _task
    _task = asyncio.create_task(_stream_loop(), name="cv_stream_service")
    logger.info("CV stream service started")


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
        logger.info("CV stream service stopped")
