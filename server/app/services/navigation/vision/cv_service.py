import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import app.services.navigation.dust_stream_service as dust_stream
import cv2
import numpy as np
from app.core.config import settings
from ultralytics import YOLO

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


def _in_exclusion_zone(bbox: tuple[int, int, int, int], img_w: int, img_h: int) -> bool:
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


import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from ultralytics import YOLO

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


@dataclass
class _Track:
    """Temporal state for one tracked obstacle, keyed by YOLO track_id."""

    label: str
    bbox: tuple[int, int, int, int]
    confidence: float
    cx: float
    cy: float
    vx: float = 0.0  # per-frame centroid velocity (EMA-smoothed)
    vy: float = 0.0
    hits: int = 0  # total frames the detector matched this track
    misses: int = 0  # consecutive frames the detector missed it
    confirmed: bool = False


# Track table for temporal smoothing. Only _infer touches it, and _infer runs
# on the single-worker _executor, so access is already serialized — no lock.
_tracks: dict[int, _Track] = {}

_COAST_DECAY = 0.8  # confidence multiplier applied per coasted (missed) frame
_VEL_SMOOTH = 0.5  # EMA weight on prior velocity when updating track velocity


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


def _in_exclusion_zone(bbox: tuple[int, int, int, int], img_w: int, img_h: int) -> bool:
    """True when the detection's center point falls inside the exclusion zone."""
    x1, y1, x2, y2 = bbox
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    ex1, ey1, ex2, ey2 = _exclusion_zone(img_w, img_h)
    return ex1 <= cx <= ex2 and ey1 <= cy <= ey2


def _clamp_bbox(
    bbox: tuple[float, float, float, float], img_w: int, img_h: int
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        int(min(max(x1, 0), img_w - 1)),
        int(min(max(y1, 0), img_h - 1)),
        int(min(max(x2, 0), img_w - 1)),
        int(min(max(y2, 0), img_h - 1)),
    )


def _smooth(raw: list[Detection], img_w: int, img_h: int) -> list[Detection]:
    """Confirmation hysteresis + velocity-extrapolated coasting.

    A track must be matched CV_TRACK_MIN_HITS frames before it is published, and
    a confirmed track keeps being emitted — its last bbox shifted by its recent
    centroid velocity, confidence decaying — for up to CV_TRACK_MAX_AGE missed
    frames. This converts the detector's per-frame on/off into a sticky signal
    so a single missed frame no longer zeroes the danger map downstream.
    """
    seen_ids: set[int] = set()
    out: list[Detection] = []

    for det in raw:
        if det.track_id is None:
            # Tracker has not assigned an ID yet (warm-up frames): emit live;
            # coasting is impossible without a stable identity.
            out.append(det)
            continue

        seen_ids.add(det.track_id)
        x1, y1, x2, y2 = det.bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        tr = _tracks.get(det.track_id)
        if tr is None:
            tr = _Track(
                label=det.label,
                bbox=det.bbox,
                confidence=det.confidence,
                cx=cx,
                cy=cy,
            )
            _tracks[det.track_id] = tr
        else:
            tr.vx = _VEL_SMOOTH * tr.vx + (1 - _VEL_SMOOTH) * (cx - tr.cx)
            tr.vy = _VEL_SMOOTH * tr.vy + (1 - _VEL_SMOOTH) * (cy - tr.cy)
            tr.label = det.label
            tr.bbox = det.bbox
            tr.confidence = det.confidence
            tr.cx = cx
            tr.cy = cy
        tr.hits += 1
        tr.misses = 0
        if tr.hits >= settings.CV_TRACK_MIN_HITS:
            tr.confirmed = True
        if tr.confirmed:
            out.append(det)

    # Age every track the detector did not match this frame; coast the
    # confirmed ones, drop unconfirmed blips and tracks past max age.
    for tid, tr in list(_tracks.items()):
        if tid in seen_ids:
            continue
        tr.misses += 1
        if not tr.confirmed or tr.misses > settings.CV_TRACK_MAX_AGE:
            del _tracks[tid]
            continue
        sx = tr.vx * tr.misses
        sy = tr.vy * tr.misses
        bx1, by1, bx2, by2 = tr.bbox
        pred = _clamp_bbox((bx1 + sx, by1 + sy, bx2 + sx, by2 + sy), img_w, img_h)
        if _in_exclusion_zone(pred, img_w, img_h):
            continue
        out.append(
            Detection(
                label=tr.label,
                confidence=tr.confidence * (_COAST_DECAY**tr.misses),
                bbox=pred,
                track_id=tid,
            )
        )

    return out


def _infer(frame_bytes: bytes) -> CVResult | None:
    """Decode JPEG → YOLO track → structured detections. Runs in thread pool."""
    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    img_h, img_w = img.shape[:2]

    # persist=True keeps tracker state between frames, suppressing flicker.
    results = _model.track(  # type: ignore[misc]
        img, persist=True, conf=settings.CV_CONF, verbose=False
    )

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

    return CVResult(frame=img, detections=_smooth(detections, img_w, img_h))


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
    _tracks.clear()
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
        _tracks.clear()
        logger.info("CV service stopped")
