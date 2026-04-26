import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.navigation.navigation_service import (
    execute_ping,
    navigation_state,
    start_autonomous_loop,
    stop_autonomous_loop,
)

router = APIRouter()


@router.get("/navigation/stream")
async def navigation_stream():
    """Server-Sent Events (SSE) stream for real-time navigation state."""

    async def event_generator():
        try:
            while True:
                state = await navigation_state.get_snapshot()
                yield f"data: {state.model_dump_json()}\n\n"
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/navigation/autonomy/start")
async def autonomy_start(force_reset: bool = False):
    """
    Turn on autonomous driving.
    If no session exists, it initializes a new one.
    If force_reset=True is passed, it wipes the current map and starts over.
    """
    try:
        await start_autonomous_loop(force_reset=force_reset)
        return {"status": "Autonomous driving activated", "reset": force_reset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/navigation/autonomy/stop")
async def autonomy_stop():
    """Turn off autonomous driving (returns control to WASD)."""
    await stop_autonomous_loop()
    return {"status": "Autonomous driving disabled, brakes applied"}


@router.get("/navigation/session/status")
async def get_session_status():
    """Get current search session status."""
    state = await navigation_state.get_snapshot()
    if not state.session:
        return {"error": "No active session"}
    return state.session.model_dump()


@router.post("/navigation/ping/execute")
async def execute_navigation_ping():
    """Execute a manual ping."""
    try:
        success, rssi_value, category = await execute_ping()
        return {
            "success": success,
            "rssi_value": rssi_value,
            "category": category.value,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/target/current")
async def get_current_target():
    """Get current navigation target."""
    state = await navigation_state.get_snapshot()
    if not state.session or not state.session.current_target:
        return {"error": "No current target"}
    return state.session.current_target.model_dump()
