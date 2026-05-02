import asyncio

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
            "x": await telemetry_service.eva_data.get_eva1_pos_x(),
            "y": await telemetry_service.eva_data.get_eva1_pos_y(),
        },
        "eva2": {
            "x": await telemetry_service.eva_data.get_eva2_pos_x(),
            "y": await telemetry_service.eva_data.get_eva2_pos_y(),
        },
    }


async def get_best_path_routing() -> dict:
    path = await get_recommended_path()
    fuel = await telemetry_service.ltv_data.get_consumables_fuel_level()
    max_range = 50000  # meters
    available_range = max_range * (fuel / 100) if fuel else 0

    # Calculate total path distance (simple Euclidean)
    total_distance = 0
    for i in range(1, len(path)):
        dx = path[i]["x"] - path[i - 1]["x"]
        dy = path[i]["y"] - path[i - 1]["y"]
        total_distance += (dx**2 + dy**2) ** 0.5

    can_reach = total_distance <= available_range
    return {
        "path": path,
        "total_distance": total_distance,
        "available_range": available_range,
        "can_reach": can_reach,
        "warning": "Insufficient fuel to reach destination" if not can_reach else None,
    }


async def get_ltv_location() -> dict:
    position = {
        "x": await telemetry_service.ltv_data.get_location_last_known_x(),
        "y": await telemetry_service.ltv_data.get_location_last_known_y(),
    }
    signal = {
        "strength": await telemetry_service.ltv_data.get_signal_strength(),
        "ping_requested": await telemetry_service.ltv_data.get_signal_ping_requested(),
    }
    return {**position, "signal": signal}


async def get_ltv_search_radius() -> dict:
    last_updated = await telemetry_service.ltv_data.get_last_updated()
    if last_updated is None:
        return {"radius": 0}
    current_time = asyncio.get_event_loop().time()
    time_away = current_time - last_updated
    max_speed = 10  # m/s, assume max speed of LTV
    radius = max_speed * time_away
    return {"radius": radius}


async def get_hazards() -> list:
    # Mock hazards data - in real implementation, this would come from telemetry or database
    return [
        {"type": "crater", "x": 100, "y": 200, "radius": 50},
        {"type": "boulder", "x": 300, "y": 400, "size": 10},
    ]


async def get_waypoints() -> list:
    # Mock waypoints - mission waypoints
    return [
        {"label": "Waypoint 1", "x": 500, "y": 600},
        {"label": "Waypoint 2", "x": 700, "y": 800},
    ]


async def get_recommended_path() -> list:
    # Mock AI-recommended path
    return [
        {"x": 0, "y": 0},
        {"x": 100, "y": 100},
        {"x": 200, "y": 200},
    ]
