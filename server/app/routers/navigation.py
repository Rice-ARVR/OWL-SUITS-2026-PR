from typing import List

from fastapi import APIRouter, HTTPException

from app.services.navigation.navigation_service import (
    execute_navigation_step,
    execute_ping,
    navigation_state,
    start_search_session,
)

router = APIRouter()


@router.post("/navigation/session/start")
async def start_navigation_session():
    """Start a new navigation search session."""
    try:
        session = await start_search_session()
        return {
            "session_id": session.session_id,
            "phase": session.phase.value,
            "search_center": session.search_center.model_dump(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/session/status")
async def get_session_status():
    """Get current search session status."""
    state = await navigation_state.get_snapshot()
    if not state.session:
        return {"error": "No active session"}
    return state.session.model_dump()


@router.get("/navigation/grid/status")
async def get_grid_status():
    """Get current occupancy grid status."""
    state = await navigation_state.get_snapshot()
    if not state.session:
        return {"sectors": []}

    sectors = [
        {
            "x": cell.sector_x,
            "y": cell.sector_y,
            "state": cell.state.value,
            "last_rssi": cell.last_rssi,
        }
        for cell in state.session.occupancy_grid.cells.values()
    ]
    return {"sectors": sectors}


@router.post("/navigation/ping/execute")
async def execute_navigation_ping():
    """Execute a ping and update navigation state."""
    try:
        success, rssi_value, category = await execute_ping()
        return {
            "success": success,
            "rssi_value": rssi_value,
            "category": category.value,
            "next_phase": None,  # TODO: Implement phase transitions
            "waypoint_generated": False,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/navigation/execute")
async def execute_navigation(
    rover_x: float, rover_y: float, rover_heading: float, lidar_array: List[float]
):
    """Execute navigation step with current rover state."""
    try:
        result = await execute_navigation_step(
            rover_x, rover_y, rover_heading, lidar_array
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/target/current")
async def get_current_target():
    """Get current navigation target."""
    state = await navigation_state.get_snapshot()
    if not state.session or not state.session.current_target:
        return {"error": "No current target"}
    return state.session.current_target.model_dump()


@router.get("/navigation/state")
async def get_navigation_state():
    """Get complete navigation state."""
    state = await navigation_state.get_snapshot()
    return state.model_dump()
