import asyncio

from pydantic import BaseModel


# --- Pydantic schema ---

class Eva1Telemetry(BaseModel):
    primary_battery_level: float
    secondary_battery_level: float
    oxy_pri_storage: float
    oxy_sec_storage: float
    oxy_pri_pressure: float
    oxy_sec_pressure: float
    suit_pressure_oxy: float
    suit_pressure_co2: float
    suit_pressure_other: float
    suit_pressure_total: float
    helmet_pressure_co2: float
    fan_pri_rpm: float
    fan_sec_rpm: float
    scrubber_a_co2_storage: float
    scrubber_b_co2_storage: float
    temperature: float
    coolant_storage: float
    coolant_gas_pressure: float
    coolant_liquid_pressure: float
    heart_rate: float
    oxy_consumption: float
    co2_production: float
    eva_elapsed_time: float


class Eva2Telemetry(BaseModel):
    battery_level: float
    oxy_pri_storage: float
    oxy_sec_storage: float
    oxy_pri_pressure: float
    oxy_sec_pressure: float
    suit_pressure_oxy: float
    suit_pressure_co2: float
    suit_pressure_other: float
    suit_pressure_total: float
    helmet_pressure_co2: float
    fan_pri_rpm: float
    fan_sec_rpm: float
    scrubber_a_co2_storage: float
    scrubber_b_co2_storage: float
    temperature: float
    coolant_storage: float
    coolant_gas_pressure: float
    coolant_liquid_pressure: float
    heart_rate: float
    oxy_consumption: float
    co2_production: float
    eva_elapsed_time: float


class EvaTelemetryBlock(BaseModel):
    eva1: Eva1Telemetry
    eva2: Eva2Telemetry


class EvaStatus(BaseModel):
    started: bool


class Eva1Battery(BaseModel):
    lu: bool
    ps: bool


class DcuEva1(BaseModel):
    oxy: bool
    fan: bool
    pump: bool
    co2: bool
    batt: Eva1Battery


class DcuEva2(BaseModel):
    batt: bool
    oxy: bool
    comm: bool
    fan: bool
    pump: bool
    co2: bool


class Dcu(BaseModel):
    eva1: DcuEva1
    eva2: DcuEva2


class EvaError(BaseModel):
    fan_error: bool
    oxy_error: bool
    power_error: bool
    scrubber_error: bool


class ImuUnit(BaseModel):
    posx: float
    posy: float
    heading: float


class Imu(BaseModel):
    eva1: ImuUnit
    eva2: ImuUnit


class Uia(BaseModel):
    eva1_power: bool
    eva1_oxy: bool
    eva1_water_supply: bool
    eva1_water_waste: bool
    eva2_power: bool
    eva2_oxy: bool
    eva2_water_supply: bool
    eva2_water_waste: bool
    oxy_vent: bool
    depress: bool


class EvaSchema(BaseModel):
    telemetry: EvaTelemetryBlock
    status: EvaStatus
    dcu: Dcu
    error: EvaError
    imu: Imu
    uia: Uia


# --- Wrapper ---

class EvaData:
    def __init__(self) -> None:
        self._data: EvaSchema | None = None
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update(self, raw: dict) -> None:
        parsed = EvaSchema.model_validate(raw)
        async with self._lock:
            self._data = parsed

    async def get_snapshot(self) -> EvaSchema | None:
        async with self._lock:
            return self._data

    # --- eva1 telemetry ---

    async def get_eva1_primary_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.primary_battery_level if self._data else None

    async def get_eva1_secondary_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.secondary_battery_level if self._data else None

    async def get_eva1_oxy_pri_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.oxy_pri_storage if self._data else None

    async def get_eva1_oxy_sec_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.oxy_sec_storage if self._data else None

    async def get_eva1_oxy_pri_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.oxy_pri_pressure if self._data else None

    async def get_eva1_oxy_sec_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.oxy_sec_pressure if self._data else None

    async def get_eva1_suit_pressure_oxy(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.suit_pressure_oxy if self._data else None

    async def get_eva1_suit_pressure_co2(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.suit_pressure_co2 if self._data else None

    async def get_eva1_suit_pressure_other(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.suit_pressure_other if self._data else None

    async def get_eva1_suit_pressure_total(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.suit_pressure_total if self._data else None

    async def get_eva1_helmet_pressure_co2(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.helmet_pressure_co2 if self._data else None

    async def get_eva1_fan_pri_rpm(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.fan_pri_rpm if self._data else None

    async def get_eva1_fan_sec_rpm(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.fan_sec_rpm if self._data else None

    async def get_eva1_scrubber_a_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.scrubber_a_co2_storage if self._data else None

    async def get_eva1_scrubber_b_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.scrubber_b_co2_storage if self._data else None

    async def get_eva1_temperature(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.temperature if self._data else None

    async def get_eva1_coolant_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.coolant_storage if self._data else None

    async def get_eva1_coolant_gas_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.coolant_gas_pressure if self._data else None

    async def get_eva1_coolant_liquid_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.coolant_liquid_pressure if self._data else None

    async def get_eva1_heart_rate(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.heart_rate if self._data else None

    async def get_eva1_oxy_consumption(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.oxy_consumption if self._data else None

    async def get_eva1_co2_production(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.co2_production if self._data else None

    async def get_eva1_eva_elapsed_time(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.eva_elapsed_time if self._data else None

    # --- eva2 telemetry ---

    async def get_eva2_battery_level(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.battery_level if self._data else None

    async def get_eva2_oxy_pri_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.oxy_pri_storage if self._data else None

    async def get_eva2_oxy_sec_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.oxy_sec_storage if self._data else None

    async def get_eva2_oxy_pri_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.oxy_pri_pressure if self._data else None

    async def get_eva2_oxy_sec_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.oxy_sec_pressure if self._data else None

    async def get_eva2_suit_pressure_oxy(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.suit_pressure_oxy if self._data else None

    async def get_eva2_suit_pressure_co2(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.suit_pressure_co2 if self._data else None

    async def get_eva2_suit_pressure_other(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.suit_pressure_other if self._data else None

    async def get_eva2_suit_pressure_total(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.suit_pressure_total if self._data else None

    async def get_eva2_helmet_pressure_co2(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.helmet_pressure_co2 if self._data else None

    async def get_eva2_fan_pri_rpm(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.fan_pri_rpm if self._data else None

    async def get_eva2_fan_sec_rpm(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.fan_sec_rpm if self._data else None

    async def get_eva2_scrubber_a_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.scrubber_a_co2_storage if self._data else None

    async def get_eva2_scrubber_b_co2_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.scrubber_b_co2_storage if self._data else None

    async def get_eva2_temperature(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.temperature if self._data else None

    async def get_eva2_coolant_storage(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.coolant_storage if self._data else None

    async def get_eva2_coolant_gas_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.coolant_gas_pressure if self._data else None

    async def get_eva2_coolant_liquid_pressure(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.coolant_liquid_pressure if self._data else None

    async def get_eva2_heart_rate(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.heart_rate if self._data else None

    async def get_eva2_oxy_consumption(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.oxy_consumption if self._data else None

    async def get_eva2_co2_production(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.co2_production if self._data else None

    async def get_eva2_eva_elapsed_time(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva2.eva_elapsed_time if self._data else None

    # --- status ---

    async def get_status_started(self) -> bool | None:
        async with self._lock:
            return self._data.status.started if self._data else None

    # --- dcu eva1 ---

    async def get_dcu_eva1_oxy(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.oxy if self._data else None

    async def get_dcu_eva1_fan(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.fan if self._data else None

    async def get_dcu_eva1_pump(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.pump if self._data else None

    async def get_dcu_eva1_co2(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.co2 if self._data else None

    async def get_dcu_eva1_batt_lu(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.batt.lu if self._data else None

    async def get_dcu_eva1_batt_ps(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva1.batt.ps if self._data else None

    # --- dcu eva2 ---

    async def get_dcu_eva2_batt(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.batt if self._data else None

    async def get_dcu_eva2_oxy(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.oxy if self._data else None

    async def get_dcu_eva2_comm(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.comm if self._data else None

    async def get_dcu_eva2_fan(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.fan if self._data else None

    async def get_dcu_eva2_pump(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.pump if self._data else None

    async def get_dcu_eva2_co2(self) -> bool | None:
        async with self._lock:
            return self._data.dcu.eva2.co2 if self._data else None

    # --- error ---

    async def get_error_fan_error(self) -> bool | None:
        async with self._lock:
            return self._data.error.fan_error if self._data else None

    async def get_error_oxy_error(self) -> bool | None:
        async with self._lock:
            return self._data.error.oxy_error if self._data else None

    async def get_error_power_error(self) -> bool | None:
        async with self._lock:
            return self._data.error.power_error if self._data else None

    async def get_error_scrubber_error(self) -> bool | None:
        async with self._lock:
            return self._data.error.scrubber_error if self._data else None

    # --- imu ---

    async def get_imu_eva1_posx(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva1.posx if self._data else None

    async def get_imu_eva1_posy(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva1.posy if self._data else None

    async def get_imu_eva1_heading(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva1.heading if self._data else None

    async def get_imu_eva2_posx(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva2.posx if self._data else None

    async def get_imu_eva2_posy(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva2.posy if self._data else None

    async def get_imu_eva2_heading(self) -> float | None:
        async with self._lock:
            return self._data.imu.eva2.heading if self._data else None

    # --- uia ---

    async def get_uia_eva1_power(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva1_power if self._data else None

    async def get_uia_eva1_oxy(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva1_oxy if self._data else None

    async def get_uia_eva1_water_supply(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva1_water_supply if self._data else None

    async def get_uia_eva1_water_waste(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva1_water_waste if self._data else None

    async def get_uia_eva2_power(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva2_power if self._data else None

    async def get_uia_eva2_oxy(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva2_oxy if self._data else None

    async def get_uia_eva2_water_supply(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva2_water_supply if self._data else None

    async def get_uia_eva2_water_waste(self) -> bool | None:
        async with self._lock:
            return self._data.uia.eva2_water_waste if self._data else None

    async def get_uia_oxy_vent(self) -> bool | None:
        async with self._lock:
            return self._data.uia.oxy_vent if self._data else None

    async def get_uia_depress(self) -> bool | None:
        async with self._lock:
            return self._data.uia.depress if self._data else None
