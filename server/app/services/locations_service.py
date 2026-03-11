import app.services.telemetry.telemetry_service as telemetry_service


async def get_rover_location() -> dict:
    return {
        "x": await telemetry_service.rover_data.get_pr_rover_pos_x(),
        "y": await telemetry_service.rover_data.get_pr_rover_pos_y(),
        "z": await telemetry_service.rover_data.get_pr_rover_pos_z(),
    }


async def get_eva_locations() -> dict:
    return {
        "eva1": {
            "x": await telemetry_service.eva_data.get_imu_eva1_posx(),
            "y": await telemetry_service.eva_data.get_imu_eva1_posy(),
        },
        "eva2": {
            "x": await telemetry_service.eva_data.get_imu_eva2_posx(),
            "y": await telemetry_service.eva_data.get_imu_eva2_posy(),
        },
    }