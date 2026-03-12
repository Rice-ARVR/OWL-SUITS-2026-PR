import asyncio

from pydantic import BaseModel


# --- Pydantic schema ---

class PrTelemetry(BaseModel):
    cabin_heating: bool
    cabin_cooling: bool
    lights_on: bool
    brakes: bool
    throttle: float
    steering: float
    rover_pos_x: float
    rover_pos_y: float
    rover_pos_z: float
    heading: float
    pitch: float
    roll: float
    distance_traveled: float
    speed: float
    sunlight: float
    surface_incline: float
    lidar: list[float]
    oxygen_storage: float
    oxygen_pressure: float
    cabin_pressure: float
    cabin_temperature: float
    external_temp: float
    coolant_pressure: float
    coolant_storage: float
    primary_battery_level: float
    secondary_battery_level: float
    rover_elapsed_time: float
    sim_running: bool
    dust_connected: bool
    distance_from_base: float
    oxygen_tank: float
    battery_level: float
    fan_pri_rpm: float
    fan_sec_rpm: float
    scrubber_a_co2_storage: float
    scrubber_b_co2_storage: float
    cabin_temperature_target: float


class RoverSchema(BaseModel):
    pr_telemetry: PrTelemetry


# --- Wrapper ---

class RoverData:
    def __init__(self) -> None:
        self._data: RoverSchema | None = None
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update(self, raw: dict) -> None:
        parsed = RoverSchema.model_validate(raw)
        async with self._lock:
            self._data = parsed

    async def get_snapshot(self) -> RoverSchema | None:
        async with self._lock:
            return self._data

    # --- pr_telemetry ---

    async def get_pr_cabin_heating(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.cabin_heating if self._data else None

    async def get_pr_cabin_cooling(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.cabin_cooling if self._data else None

    async def get_pr_lights_on(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.lights_on if self._data else None

    async def get_pr_brakes(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.brakes if self._data else None

    async def get_pr_throttle(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.throttle if self._data else None

    async def get_pr_steering(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.steering if self._data else None

    async def get_pr_rover_pos_x(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.rover_pos_x if self._data else None

    async def get_pr_rover_pos_y(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.rover_pos_y if self._data else None

    async def get_pr_rover_pos_z(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.rover_pos_z if self._data else None

    async def get_pr_heading(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.heading if self._data else None

    async def get_pr_pitch(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.pitch if self._data else None

    async def get_pr_roll(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.roll if self._data else None

    async def get_pr_distance_traveled(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.distance_traveled if self._data else None

    async def get_pr_speed(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.speed if self._data else None

    async def get_pr_sunlight(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.sunlight if self._data else None

    async def get_pr_surface_incline(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.surface_incline if self._data else None

    async def get_pr_lidar(self) -> list[float] | None:
        async with self._lock:
            return self._data.pr_telemetry.lidar if self._data else None

    async def get_pr_lidar_at(self, index: int) -> float | None:
        async with self._lock:
            if self._data is None:
                return None
            return self._data.pr_telemetry.lidar[index]

    async def get_pr_oxygen_storage(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.oxygen_storage if self._data else None

    async def get_pr_oxygen_pressure(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.oxygen_pressure if self._data else None

    async def get_pr_fan_pri_rpm(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.fan_pri_rpm if self._data else None

    async def get_pr_fan_sec_rpm(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.fan_sec_rpm if self._data else None

    async def get_pr_cabin_pressure(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.cabin_pressure if self._data else None

    async def get_pr_cabin_temperature(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.cabin_temperature if self._data else None

    async def get_pr_external_temp(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.external_temp if self._data else None

    async def get_pr_coolant_pressure(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.coolant_pressure if self._data else None

    async def get_pr_coolant_storage(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.coolant_storage if self._data else None

    async def get_pr_rover_elapsed_time(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.rover_elapsed_time if self._data else None

    async def get_pr_sim_running(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.sim_running if self._data else None

    async def get_pr_dust_connected(self) -> bool | None:
        async with self._lock:
            return self._data.pr_telemetry.dust_connected if self._data else None

    async def get_pr_distance_from_base(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.distance_from_base if self._data else None

    async def get_pr_oxygen_tank(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.oxygen_tank if self._data else None

    async def get_pr_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.battery_level if self._data else None

    async def get_pr_primary_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.primary_battery_level if self._data else None

    async def get_pr_secondary_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.secondary_battery_level if self._data else None

    async def get_pr_scrubber_a_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.scrubber_a_co2_storage if self._data else None

    async def get_pr_scrubber_b_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.scrubber_b_co2_storage if self._data else None

    async def get_pr_cabin_temperature_target(self) -> float | None:
        async with self._lock:
            return self._data.pr_telemetry.cabin_temperature_target if self._data else None
