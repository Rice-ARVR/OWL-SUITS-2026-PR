import asyncio

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self._clients: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._clients:
                self._clients.remove(ws)

    async def broadcast(self, message: str) -> None:
        async with self._lock:
            clients = list(self._clients)
        disconnected = []
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(ws)
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    if ws in self._clients:
                        self._clients.remove(ws)

    async def broadcast_bytes(self, data: bytes) -> None:
        async with self._lock:
            clients = list(self._clients)
        disconnected = []
        for ws in clients:
            try:
                await ws.send_bytes(data)
            except Exception:
                disconnected.append(ws)
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    if ws in self._clients:
                        self._clients.remove(ws)
