import asyncio
import logging

from app.core.config import settings
from app.models.eva import EvaData
from app.models.ltv import LtvData
from app.models.ltv_errors import LtvErrorsData
from app.models.rover import RoverData
from app.services.rag.context_builder import build_and_save_context
from app.services.telemetry.telemetry_ws_service import broadcast_snapshot
from app.services.telemetry.warning_service import check_and_broadcast
from app.services.telemetry.tss_client import (
    COMMAND_EVA,
    COMMAND_LTV,
    COMMAND_LTV_ERRORS,
    COMMAND_ROVER,
    fetch_json,
)

logger = logging.getLogger(__name__)

eva_data: EvaData | None = None
ltv_data: LtvData | None = None
ltv_errors_data: LtvErrorsData | None = None
rover_data: RoverData | None = None

_polling_task: asyncio.Task | None = None


async def _poll_once() -> None:
    """Pulls Rover, EVA, and LTV Data from TSS once"""

    # Fetch Rover, EVA, LTV, and LTV Errors data at once
    results = await asyncio.gather(
        fetch_json(COMMAND_ROVER),
        fetch_json(COMMAND_EVA),
        fetch_json(COMMAND_LTV),
        fetch_json(COMMAND_LTV_ERRORS),
        return_exceptions=True,
    )
    rover_result, eva_result, ltv_result, ltv_errors_result = results

    # Error checking on fetch request
    if isinstance(rover_result, Exception):
        logger.error("Failed to fetch ROVER data: %s", rover_result)
    else:
        await rover_data.update(rover_result)

    if isinstance(eva_result, Exception):
        logger.error("Failed to fetch EVA data: %s", eva_result)
    else:
        await eva_data.update(eva_result)

    if isinstance(ltv_result, Exception):
        logger.error("Failed to fetch LTV data: %s", ltv_result)
    else:
        await ltv_data.update(ltv_result)

    if isinstance(ltv_errors_result, Exception):
        logger.error("Failed to fetch LTV ERRORS data: %s", ltv_errors_result)
    else:
        await ltv_errors_data.update(ltv_errors_result)
    # take snapshots once, reuse for both warning check and RAG context
    eva_snap = await eva_data.get_snapshot()
    rover_snap = await rover_data.get_snapshot()
    ltv_snap = await ltv_data.get_snapshot()
    ltv_errors_snap = await ltv_errors_data.get_snapshot()

    # push full snapshot to connected telemetry WebSocket clients
    await broadcast_snapshot(eva_snap, rover_snap, ltv_snap, ltv_errors_snap)
    # check telemetry values against ranges and broadcast warnings over websocket if needed
    await check_and_broadcast(eva_snap, rover_snap)
    # write latest telemetry snapshot to RAG context file
    await build_and_save_context(
        eva=eva_snap,
        rover=rover_snap,
        ltv=ltv_snap,
        ltv_errors=ltv_errors_snap,
    )


async def _polling_loop() -> None:
    """Pulls Rover, EVA, and LTV data from TSS in a loop"""

    while True:
        # Record start time
        t0 = asyncio.get_event_loop().time()
        try:
            await _poll_once()
        except Exception as exc:
            logger.exception("Unexpected error in polling loop: %s", exc)

        # Adaptive sleep time to gaurentee consisten poll_interval refreshes
        elapsed = asyncio.get_event_loop().time() - t0
        await asyncio.sleep(max(0.0, settings.POLL_INTERVAL - elapsed))


async def start_polling() -> None:
    """Creates and starts updating global TSS data objects"""

    # Initializes global representations of the pulled data
    global eva_data, ltv_data, ltv_errors_data, rover_data, _polling_task

    eva_data = EvaData()
    ltv_data = LtvData()
    ltv_errors_data = LtvErrorsData()
    rover_data = RoverData()

    # Starts polling task
    _polling_task = asyncio.create_task(_polling_loop(), name="telemetry_poller")
    logger.info(
        "Telemetry polling started (interval=%.1fs, host=%s:%d)",
        settings.POLL_INTERVAL,
        settings.TSS_HOST,
        settings.TSS_PORT,
    )


async def stop_polling() -> None:
    """Stops the infinite loop of updating the TSS data objects"""

    # Kills and reaps current polling task
    global _polling_task
    if _polling_task is not None:
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
        logger.info("Telemetry polling stopped.")
