import asyncio

from pydantic import BaseModel


# --- Pydantic schema ---

class LtvLocation(BaseModel):
    last_known_x: float
    last_known_y: float


class LtvSignal(BaseModel):
    strength: float
    pings_left: int
    ping_requested: bool


class LtvErrors(BaseModel):
    recovery_mode: bool
    dust_sensor: bool
    power_distribution: bool
    nav_system: bool
    electronic_heater: bool
    comms: bool
    fuse: bool


class LtvSchema(BaseModel):
    location: LtvLocation
    signal: LtvSignal
    errors: LtvErrors


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

    async def get_signal_pings_left(self) -> int | None:
        async with self._lock:
            return self._data.signal.pings_left if self._data else None

    async def get_signal_ping_requested(self) -> bool | None:
        async with self._lock:
            return self._data.signal.ping_requested if self._data else None

    # --- errors ---

    async def get_errors_recovery_mode(self) -> bool | None:
        async with self._lock:
            return self._data.errors.recovery_mode if self._data else None

    async def get_errors_dust_sensor(self) -> bool | None:
        async with self._lock:
            return self._data.errors.dust_sensor if self._data else None

    async def get_errors_power_distribution(self) -> bool | None:
        async with self._lock:
            return self._data.errors.power_distribution if self._data else None

    async def get_errors_nav_system(self) -> bool | None:
        async with self._lock:
            return self._data.errors.nav_system if self._data else None

    async def get_errors_electronic_heater(self) -> bool | None:
        async with self._lock:
            return self._data.errors.electronic_heater if self._data else None

    async def get_errors_comms(self) -> bool | None:
        async with self._lock:
            return self._data.errors.comms if self._data else None

    async def get_errors_fuse(self) -> bool | None:
        async with self._lock:
            return self._data.errors.fuse if self._data else None
