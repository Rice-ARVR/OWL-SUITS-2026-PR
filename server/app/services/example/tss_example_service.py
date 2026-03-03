import app.services.telemetry.telemetry_service as telemetry_service


async def get_tss_example() -> dict:
    return {
        "eva_heart_rate": await telemetry_service.eva_data.get_eva1_heart_rate(),
        "eva_temperature": await telemetry_service.eva_data.get_eva1_temperature(),
        "ltv_signal_strength": await telemetry_service.ltv_data.get_signal_strength(),
        "ltv_last_known_x": await telemetry_service.ltv_data.get_location_last_known_x(),
        "rover_speed": await telemetry_service.rover_data.get_pr_speed(),
        "rover_battery_level": await telemetry_service.rover_data.get_pr_battery_level(),
    }
