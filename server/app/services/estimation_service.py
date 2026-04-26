"""
Rates are determined from the formulas that TSS's simulation engine uses for consumables below
https://github.com/SUITS-Techteam/TSS2026/blob/main/src/README.md#telemetry-simulation-development

There are 2 versions of each estimation function (Python overloading is buns).
1. Synchronous: accepts parameters, for arbitrary estimations.
2. Asynchronous: doesn't accept parameters, reads from live telemetry values and estimates based off those.

Synchronous is provided for the AIA and PNR (point of no return) estimates, in case we need time estimates for arbitrary telemetry data (rather than live data).
Asynchronous is provided for telemetry dashboard use (live data).
"""

import app.services.telemetry.telemetry_service as telemetry_service


# --- Pure math (synchronous) ---
def rover_battery_time_remaining(
    battery_level: float | None, speed: float | None
) -> float | None:
    if battery_level is None:
        return None
    rate = 0.02857 + (speed or 0.0) * 0.00508
    return battery_level / rate if rate > 0 else None


def rover_oxygen_time_remaining(oxygen_storage: float | None) -> float | None:
    if oxygen_storage is None:
        return None
    return max(0.0, oxygen_storage / 0.04)


def eva_battery_time_remaining(battery_level: float | None) -> float | None:
    if battery_level is None:
        return None
    return battery_level / 0.05


def eva_oxygen_time_remaining(oxygen_storage: float | None) -> float | None:
    if oxygen_storage is None:
        return None
    return oxygen_storage / 0.1


# --- From current telemetry (asynchronous) ---
async def current_rover_battery_time_remaining() -> float | None:
    battery_level = await telemetry_service.rover_data.get_pr_primary_battery_level()
    speed = await telemetry_service.rover_data.get_pr_speed()
    return rover_battery_time_remaining(battery_level, speed)


async def current_rover_oxygen_time_remaining() -> float | None:
    oxygen_storage = await telemetry_service.rover_data.get_pr_oxygen_storage()
    return rover_oxygen_time_remaining(oxygen_storage)


async def current_eva_battery_time_remaining() -> float | None:
    battery_level = await telemetry_service.eva_data.get_eva1_primary_battery_level()
    return eva_battery_time_remaining(battery_level)


async def current_eva_oxygen_time_remaining() -> float | None:
    oxygen_storage = await telemetry_service.eva_data.get_eva1_oxy_pri_storage()
    return eva_oxygen_time_remaining(oxygen_storage)
