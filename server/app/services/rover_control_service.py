import asyncio
import app.services.telemetry.tss_client as tss_client


async def send_rover_command(payload: dict) -> None:
    # Send individual control commands based on provided fields
    if "brakes" in payload:
        await asyncio.to_thread(tss_client.send_brakes, float(payload["brakes"]))
    if "throttle" in payload:
        await asyncio.to_thread(tss_client.send_throttle, float(payload["throttle"]))
    if "steering" in payload:
        await asyncio.to_thread(tss_client.send_steering, float(payload["steering"]))
    if "cabin_heating" in payload:
        await asyncio.to_thread(tss_client.send_cabin_heating, float(payload["cabin_heating"]))
    if "cabin_cooling" in payload:
        await asyncio.to_thread(tss_client.send_cabin_cooling, float(payload["cabin_cooling"]))
    if "headlights" in payload:
        await asyncio.to_thread(tss_client.send_headlights, float(payload["headlights"]))
