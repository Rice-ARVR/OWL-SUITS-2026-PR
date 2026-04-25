import app.services.telemetry.telemetry_service as telemetry_service


async def get_vital_signs_rover() -> dict:
    return {
        "cabin_temperature": await telemetry_service.rover_data.get_pr_cabin_temperature(),
        "outside_temperature": await telemetry_service.rover_data.get_pr_external_temp(),
        "oxygen_storage": await telemetry_service.rover_data.get_pr_oxygen_storage(),
        "battery_level": await telemetry_service.rover_data.get_pr_primary_battery_level(),
        "cabin_pressure": await telemetry_service.rover_data.get_pr_cabin_pressure(),
        "o2_pressure": await telemetry_service.rover_data.get_pr_oxygen_pressure(),
        "coolant_storage": await telemetry_service.rover_data.get_pr_coolant_storage(),
        "coolant_pressure": await telemetry_service.rover_data.get_pr_coolant_pressure(),
        "fan1_rpm": await telemetry_service.rover_data.get_pr_fan_pri_rpm(),
        "fan2_rpm": await telemetry_service.rover_data.get_pr_fan_sec_rpm(),
        "cabin_temperature_target": await telemetry_service.rover_data.get_pr_cabin_temperature_target(),
    }


async def get_vital_signs_eva() -> dict:
    return {
        "eva1": {
            "oxygen_storage": await telemetry_service.eva_data.get_eva1_oxy_pri_storage(),
            "eva_battery": await telemetry_service.eva_data.get_eva1_primary_battery_level(),
            "total_suit_pressure": await telemetry_service.eva_data.get_eva1_suit_pressure_total(),
            "o2_suit_pressure": await telemetry_service.eva_data.get_eva1_suit_pressure_oxy(),
            "co2_suit_pressure": await telemetry_service.eva_data.get_eva1_suit_pressure_co2(),
            "co2_scrubber": await telemetry_service.eva_data.get_eva1_scrubber_a_co2_storage(),
            "other_pressure": await telemetry_service.eva_data.get_eva1_suit_pressure_other(),
            "body_temperature": await telemetry_service.eva_data.get_eva1_temperature(),
            "heart_rate": await telemetry_service.eva_data.get_eva1_heart_rate(),
            "co2_production": await telemetry_service.eva_data.get_eva1_co2_production(),
            "helmet_co2_pressure": await telemetry_service.eva_data.get_eva1_helmet_pressure_co2(),
            "fan1_rpm": await telemetry_service.eva_data.get_eva1_fan_pri_rpm(),
            "fan2_rpm": await telemetry_service.eva_data.get_eva1_fan_sec_rpm(),
            "coolant_storage": await telemetry_service.eva_data.get_eva1_coolant_storage(),
            "liquid_pressure": await telemetry_service.eva_data.get_eva1_coolant_liquid_pressure(),
            "gas_pressure": await telemetry_service.eva_data.get_eva1_coolant_gas_pressure(),
        },
    }
