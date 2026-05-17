import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

import app.services.navigation.dust_stream_service as dust_stream
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 in pixels
    track_id: int | None


@dataclass
class CVResult:
    """One processed frame: the decoded BGR image plus its detections."""

    frame: np.ndarray
    detections: list[Detection]


_task: asyncio.Task | None = None
_model: YOLO | None = None
# Single-worker executor: serializes inference and keeps GPU/CPU memory predictable.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cv_worker")

_WEIGHTS_DIR = Path(__file__).parent / "model_weights"

_subscribers: set[asyncio.Queue] = set()
_lock = asyncio.Lock()


def _load_model() -> YOLO:
    for filename in (settings.CV_MODEL_PRIMARY, settings.CV_MODEL_SECONDARY):
        path = _WEIGHTS_DIR / filename
        if path.exists():
            model = YOLO(str(path))
            logger.info("YOLO model loaded from %s", path)
            return model
        logger.warning("Model weights not found at %s, trying next", path)
    raise FileNotFoundError(f"No model weights found in {_WEIGHTS_DIR}")


async def subscribe() -> asyncio.Queue:
    """Register a consumer and return a queue that receives CVResult objects."""
    q: asyncio.Queue = asyncio.Queue(maxsize=2)
    async with _lock:
        _subscribers.add(q)
    return q


async def unsubscribe(q: asyncio.Queue) -> None:
    async with _lock:
        _subscribers.discard(q)


async def _publish(result: CVResult) -> None:
    async with _lock:
        for q in _subscribers:
            if q.full():
                try:
                    q.get_nowait()  # evict stale result so slow consumers don't block
                except asyncio.QueueEmpty:
                    pass
            await q.put(result)


def _exclusion_zone(img_w: int, img_h: int) -> tuple[int, int, int, int]:
    """Return (x1, y1, x2, y2) of the exclusion zone in pixels.

    Centered horizontally (25–75 % of width), covering the bottom 20 % of height.
    Filters out rover hardware (bumper/hood) that is permanently in frame.
    """
    return (
        int(img_w * 0.25),
        int(img_h * 0.80),
        int(img_w * 0.75),
        img_h,
    )


def _in_exclusion_zone(
    bbox: tuple[int, int, int, int], img_w: int, img_h: int
) -> bool:
    """True when the detection's center point falls inside the exclusion zone."""
    x1, y1, x2, y2 = bbox
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    ex1, ey1, ex2, ey2 = _exclusion_zone(img_w, img_h)
    return ex1 <= cx <= ex2 and ey1 <= cy <= ey2


def _infer(frame_bytes: bytes) -> CVResult | None:
    """Decode JPEG → YOLO track → structured detections. Runs in thread pool."""
    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    img_h, img_w = img.shape[:2]

    # persist=True keeps tracker state between frames, suppressing flicker.
    results = _model.track(img, persist=True, verbose=False)  # type: ignore[misc]

    detections: list[Detection] = []
    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        if _in_exclusion_zone((x1, y1, x2, y2), img_w, img_h):
            continue
        label = results[0].names[int(box.cls[0])]
        track_id = int(box.id[0]) if box.id is not None else None
        detections.append(
            Detection(
                label=label,
                confidence=float(box.conf[0]),
                bbox=(x1, y1, x2, y2),
                track_id=track_id,
            )
        )

    return CVResult(frame=img, detections=detections)


async def _process_loop() -> None:
    q = await dust_stream.subscribe()
    loop = asyncio.get_running_loop()
    try:
        while True:
            frame: bytes = await q.get()
            async with _lock:
                has_subscribers = bool(_subscribers)
            if has_subscribers:
                result = await loop.run_in_executor(_executor, _infer, frame)
                if result is not None:
                    await _publish(result)
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
