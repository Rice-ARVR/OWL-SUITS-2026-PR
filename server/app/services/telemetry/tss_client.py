import asyncio
import json
import socket
import struct
import time

from app.core.config import settings

COMMAND_ROVER = 0
COMMAND_EVA = 1
COMMAND_LTV = 2


def _build_packet(command: int) -> bytes:
    """Prepares packet of data to send over network"""
    return struct.pack(">II", int(time.time()), command)


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
    text = raw[8:].decode("utf-8")
    obj, _ = json.JSONDecoder().raw_decode(text.lstrip())
    return obj
