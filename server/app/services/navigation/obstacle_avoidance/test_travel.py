#!/usr/bin/env python3
"""
Live test script for travel().

Run from the server/ directory (so app.* imports resolve):
    python test_travel.py <targetX> <targetY>

Example:
    python test_travel.py 150.0 -80.0

The script:
  1. Starts the telemetry poller (same one the main server uses).
  2. Waits for a live DUST reading.
  3. Runs travel() while printing a status line every second.
  4. Prints SUCCESS or FAILED when done.
"""

import argparse
import asyncio
import logging
import math

import app.services.telemetry.telemetry_service as telemetry_service
from app.services.navigation.obstacle_avoidance.auto_drive import travel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("test_travel")


async def _monitor(targetX: float, targetY: float) -> None:
    """Prints a live telemetry status line once per second."""
    while True:
        rover = telemetry_service.rover_data
        if rover:
            snap = await rover.get_snapshot()
            if snap:
                tel = snap.pr_telemetry
                dist = math.hypot(targetX - tel.rover_pos_x, targetY - tel.rover_pos_y)
                logger.info(
                    "pos=(%.1f, %.1f)  hdg=%.1f°  spd=%.1f  dist_to_target=%.1f m  "
                    "throttle=%.0f  steering=%.2f",
                    tel.rover_pos_x,
                    tel.rover_pos_y,
                    tel.heading,
                    tel.speed,
                    dist,
                    tel.throttle,
                    tel.steering,
                )
        await asyncio.sleep(1.0)


async def main(targetX: float, targetY: float) -> None:
    await telemetry_service.start_polling()
    logger.info("Waiting for first DUST telemetry reading...")

    # Wait up to 5 s for a valid snapshot
    for _ in range(50):
        if telemetry_service.rover_data:
            snap = await telemetry_service.rover_data.get_snapshot()
            if snap is not None:
                break
        await asyncio.sleep(0.1)
    else:
        logger.error("No telemetry after 5 s — is DUST running and reachable?")
        await telemetry_service.stop_polling()
        return

    tel = snap.pr_telemetry
    logger.info(
        "DUST connected — rover at (%.1f, %.1f), heading %.1f°",
        tel.rover_pos_x,
        tel.rover_pos_y,
        tel.heading,
    )
    logger.info("Launching travel(%.1f, %.1f) ...", targetX, targetY)

    monitor = asyncio.create_task(_monitor(targetX, targetY))

    result = await travel(targetX, targetY)

    monitor.cancel()
    await telemetry_service.stop_polling()

    if result == 0:
        logger.info("=== SUCCESS — rover arrived at target ===")
    else:
        logger.warning("=== FAILED — control returned to user ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live test for travel()")
    parser.add_argument("x", type=float, help="Target X coordinate (meters)")
    parser.add_argument("y", type=float, help="Target Y coordinate (meters)")
    args = parser.parse_args()
    asyncio.run(main(args.x, args.y))
