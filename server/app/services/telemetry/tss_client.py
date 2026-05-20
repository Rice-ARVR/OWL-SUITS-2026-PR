import asyncio
import json
import socket
import struct
import time

from app.core.config import settings

COMMAND_ROVER = 0
COMMAND_EVA = 1
COMMAND_LTV = 2
COMMAND_LTV_ERRORS = 3
COMMAND_CABIN_HEATING = 1103
COMMAND_CABIN_COOLING = 1104
COMMAND_HEADLIGHTS = 1106
COMMAND_BRAKES = 1107
COMMAND_THROTTLE = 1109
COMMAND_STEERING = 1110
COMMAND_LTV_PING_NORMAL = 2050
COMMAND_LTV_PING_UNLIMITED = 2051


def _build_packet(command: int) -> bytes:
    """Prepares packet of data to send over network"""
    return struct.pack(">II", int(time.time()), command)


def _build_control_packet(command: int, value: float) -> bytes:
    """Prepares a control packet with command and float value."""
    return struct.pack(">IIf", int(time.time()), command, value)


def _send_command(host: str, port: int, packet: bytes, timeout: float) -> None:
    """Sends a UDP packet without demanding a reply."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(timeout)
        try:
            sock.sendto(packet, (host, port))
        except OSError:
            pass


def send_cabin_heating(value: float) -> None:
    """Send cabin heating control to TSS server."""
    packet = _build_control_packet(COMMAND_CABIN_HEATING, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_cabin_cooling(value: float) -> None:
    """Send cabin cooling control to TSS server."""
    packet = _build_control_packet(COMMAND_CABIN_COOLING, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_headlights(value: float) -> None:
    """Send headlights control to TSS server."""
    packet = _build_control_packet(COMMAND_HEADLIGHTS, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_brakes(value: float) -> None:
    """Send brakes control to TSS server."""
    packet = _build_control_packet(COMMAND_BRAKES, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_throttle(value: float) -> None:
    """Send throttle control to TSS server."""
    packet = _build_control_packet(COMMAND_THROTTLE, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_steering(value: float) -> None:
    """Send steering control to TSS server."""
    packet = _build_control_packet(COMMAND_STEERING, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_ltv_ping_normal(value: float) -> None:
    """Send LTV ping command (normal, 20s throttle)."""
    packet = _build_control_packet(COMMAND_LTV_PING_NORMAL, value)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def send_ltv_ping_unlimited() -> None:
    """Send LTV ping command (unlimited, for testing)."""
    packet = _build_packet(COMMAND_LTV_PING_UNLIMITED)
    _send_command(settings.TSS_HOST, settings.TSS_PORT, packet, settings.TSS_TIMEOUT)


def _send_and_receive(host: str, port: int, packet: bytes, timeout: float) -> bytes:
    """Sends and receives data packet over UDP socket"""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(timeout)
        sock.sendto(packet, (host, port))
        data, _ = sock.recvfrom(65535)
        return data


async def fetch_json(command: int) -> dict:
    """Creates new background thread to process JSON Fetching I/O"""
    packet = _build_packet(command)
    raw = await asyncio.to_thread(
        _send_and_receive,
        settings.TSS_HOST,
        settings.TSS_PORT,
        packet,
        settings.TSS_TIMEOUT,
    )
    text = raw[:].decode("utf-8")
    obj, _ = json.JSONDecoder().raw_decode(text.lstrip())
    return obj
