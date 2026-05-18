import asyncio
import logging

import websockets

from app.core.config import settings

logger = logging.getLogger(__name__)

_queues: set[asyncio.Queue] = set()
_lock = asyncio.Lock()
_task: asyncio.Task | None = None


async def subscribe() -> asyncio.Queue:
    """Register a consumer and return a queue that receives raw JPEG frame bytes."""
    q: asyncio.Queue = asyncio.Queue(maxsize=2)
    async with _lock:
        _queues.add(q)
    return q


async def unsubscribe(q: asyncio.Queue) -> None:
    async with _lock:
        _queues.discard(q)


async def _publish(frame: bytes) -> None:
    async with _lock:
        for q in _queues:
            if q.full():
                try:
                    q.get_nowait()  # evict stale frame so slow consumers don't block
                except asyncio.QueueEmpty:
                    pass
            await q.put(frame)


async def _connection_loop() -> None:
    url = settings.DUST_CV_WS_URL
    backoff = 1.0
    while True:
        try:
            async with websockets.connect(url) as ws:
                logger.info("Connected to dust stream at %s", url)
                backoff = 1.0
                async for message in ws:
                    if isinstance(message, bytes):
                        await _publish(message)
        except asyncio.CancelledError:
            raise
        except (websockets.WebSocketException, OSError) as e:
            logger.warning(
                "Dust stream disconnected (%s). Reconnecting in %.1fs", e, backoff
            )
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 30.0)


async def start() -> None:
    global _task
    _task = asyncio.create_task(_connection_loop(), name="dust_stream")
    logger.info("Dust stream service started (url=%s)", settings.DUST_CV_WS_URL)


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
        logger.info("Dust stream service stopped")