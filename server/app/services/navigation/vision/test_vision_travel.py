#!/usr/bin/env python3
"""
Live test script for travel_vision() — the vision-based autonomous driver.

Run from the server/ directory (so app.* imports resolve):
    python app/services/navigation/vision/test_vision_travel.py <targetX> <targetY>

Example:
    python app/services/navigation/vision/test_vision_travel.py 150.0 -80.0

The script:
  1. Starts the telemetry poller, the DUST stream, and the CV service
     (the same trio main.py wires up in its lifespan).
  2. Waits for a live DUST telemetry reading.
  3. Runs travel_vision() while printing a status line every second,
     including how many obstacles the CV model currently sees.
  4. Prints SUCCESS or FAILED when done.
"""

import argparse
import asyncio
import logging
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

import app.services.navigation.vision.cv_service as cv_service
import app.services.telemetry.telemetry_service as telemetry_service
from app.services.navigation.dust_stream_service import start as start_dust_stream
from app.services.navigation.dust_stream_service import stop as stop_dust_stream
from app.services.navigation.vision.auto_drive_vision import travel_vision

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("test_vision_travel")


async def _monitor(targetX: float, targetY: float) -> None:
    """Prints a live telemetry + detection status line once per second."""
    q = await cv_service.subscribe()
    last_dets = "—"
    try:
        while True:
            # Drain to the freshest CV result without blocking the status line.
            while True:
                try:
                    result = q.get_nowait()
                except asyncio.QueueEmpty:
                    break
                labels = [d.label for d in result.detections]
                last_dets = f"{len(labels)} {labels}" if labels else "0 []"

            rover = telemetry_service.rover_data
            if rover:
                snap = await rover.get_snapshot()
                if snap:
                    tel = snap.pr_telemetry
                    dist = math.hypot(
                        targetX - tel.rover_pos_x, targetY - tel.rover_pos_y
                    )
                    logger.info(
                        "pos=(%.1f, %.1f)  hdg=%.1f°  spd=%.1f  "
                        "dist_to_target=%.1f m  throttle=%.0f  steering=%.2f  "
                        "detections=%s",
                        tel.rover_pos_x,
                        tel.rover_pos_y,
                        tel.heading,
                        tel.speed,
                        dist,
                        tel.throttle,
                        tel.steering,
                        last_dets,
                    )
            await asyncio.sleep(1.0)
    finally:
        await cv_service.unsubscribe(q)


async def main(targetX: float, targetY: float) -> None:
    await telemetry_service.start_polling()
    await start_dust_stream()
    await cv_service.start()
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
        await cv_service.stop()
        await stop_dust_stream()
        await telemetry_service.stop_polling()
        return

    tel = snap.pr_telemetry
    logger.info(
        "DUST connected — rover at (%.1f, %.1f), heading %.1f°",
        tel.rover_pos_x,
        tel.rover_pos_y,
        tel.heading,
    )
    logger.info("Launching travel_vision(%.1f, %.1f) ...", targetX, targetY)

    monitor = asyncio.create_task(_monitor(targetX, targetY))

    try:
        result = await travel_vision(targetX, targetY)
    finally:
        monitor.cancel()
        await cv_service.stop()
        await stop_dust_stream()
        await telemetry_service.stop_polling()

    if result == 0:
        logger.info("=== SUCCESS — rover arrived at target ===")
    else:
        logger.warning("=== FAILED — control returned to user ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live test for travel_vision()")
    parser.add_argument("x", type=float, help="Target X coordinate (meters)")
    parser.add_argument("y", type=float, help="Target Y coordinate (meters)")
    args = parser.parse_args()
    asyncio.run(main(args.x, args.y))
