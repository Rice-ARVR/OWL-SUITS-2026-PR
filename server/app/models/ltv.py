import asyncio

from pydantic import BaseModel


# --- Pydantic schema ---

class LtvLocation(BaseModel):
    last_known_x: float
    last_known_y: float


class LtvSignal(BaseModel):
    strength: float
    ping_requested: int
    ping_unlimited_requested: int


class LtvSchema(BaseModel):
    location: LtvLocation
    signal: LtvSignal


# --- Wrapper ---

class LtvData:
    def __init__(self) -> None:
        self._data: LtvSchema | None = None
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update(self, raw: dict) -> None:
        parsed = LtvSchema.model_validate(raw)
        async with self._lock:
            self._data = parsed

    async def get_snapshot(self) -> LtvSchema | None:
        async with self._lock:
            return self._data

    # --- location ---

    async def get_location_last_known_x(self) -> float | None:
        async with self._lock:
            return self._data.location.last_known_x if self._data else None

    async def get_location_last_known_y(self) -> float | None:
        async with self._lock:
            return self._data.location.last_known_y if self._data else None

    # --- signal ---

    async def get_signal_strength(self) -> float | None:
        async with self._lock:
            return self._data.signal.strength if self._data else None

    async def get_signal_ping_requested(self) -> int | None:
        async with self._lock:
            return self._data.signal.ping_requested if self._data else None

    async def get_signal_ping_unlimited_requested(self) -> int | None:
        async with self._lock:
            return self._data.signal.ping_unlimited_requested if self._data else None
