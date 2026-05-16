import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

import app.services.navigation.dust_stream_service as dust_stream
from app.core.config import settings
from app.core.ws_manager import WebSocketManager

logger = logging.getLogger(__name__)

manager = WebSocketManager()

_task: asyncio.Task | None = None
_model: YOLO | None = None
# Single-worker executor: serializes inference and keeps GPU/CPU memory predictable.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cv_worker")

_WEIGHTS_DIR = Path(__file__).parent / "model_weights"


def _load_model() -> YOLO:
    for filename in (settings.CV_MODEL_PRIMARY, settings.CV_MODEL_SECONDARY):
        path = _WEIGHTS_DIR / filename
        if path.exists():
            model = YOLO(str(path))
            logger.info("YOLO model loaded from %s", path)
            return model
        logger.warning("Model weights not found at %s, trying next", path)
    raise FileNotFoundError(f"No model weights found in {_WEIGHTS_DIR}")


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


def _draw_boxes(img: np.ndarray, results) -> np.ndarray:  # type: ignore[type-arg]
    annotated = img.copy()
    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        label = results[0].names[int(box.cls[0])]
        color = _CLASS_COLORS.get(label, _DEFAULT_COLOR)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, _THICKNESS)
        cv2.putText(annotated, label, (x1, y1 - 8), _FONT, _FONT_SCALE, color, _THICKNESS)
    return annotated


def _infer(frame_bytes: bytes) -> bytes:
    """Decode JPEG → YOLO track → annotated JPEG. Runs in thread pool."""
    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return frame_bytes

    # persist=True keeps tracker state between frames, suppressing flicker.
    results = _model.track(img, persist=True, verbose=False)  # type: ignore[misc]
    annotated = _draw_boxes(img, results)

    ok, encoded = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return encoded.tobytes() if ok else frame_bytes


async def _process_loop() -> None:
    q = await dust_stream.subscribe()
    loop = asyncio.get_running_loop()
    try:
        while True:
            frame: bytes = await q.get()
            if manager._clients:
                annotated = await loop.run_in_executor(_executor, _infer, frame)
                await manager.broadcast_bytes(annotated)
    except asyncio.CancelledError:
        raise
    finally:
        await dust_stream.unsubscribe(q)


async def start() -> None:
    global _task, _model
    loop = asyncio.get_running_loop()
    _model = await loop.run_in_executor(_executor, _load_model)
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