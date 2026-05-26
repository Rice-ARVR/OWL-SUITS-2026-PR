# Backend Guide

A short reference for the server in [server/](../server/). For setup, see the project [README](../README.md).

---

## 1. Frameworks & Tools

| Tool | Purpose |
| --- | --- |
| **FastAPI** | HTTP + WebSocket framework |
| **Uvicorn** | ASGI server |
| **Pydantic** / **pydantic-settings** | Schemas, validation, `.env` config |
| **uv** | Python package + venv manager |
| **PyMongo** | MongoDB driver |
| **LangChain** + **Chroma** + **Ollama** | RAG pipeline for the AI Assistant |
| **faster-whisper** | Speech-to-text |
| **Ultralytics YOLO** + **OpenCV** + **PyTorch** | Computer vision (obstacle detection) |
| **asyncio** | Background polling, WebSocket fan-out, thread-safe locks |

Python `>=3.13.7`. Full list in [server/pyproject.toml](../server/pyproject.toml).

---

## 2. Folder Structure

```
server/
├── main.py              # FastAPI app, lifespan, router registration
├── pyproject.toml       # Dependencies (uv)
├── data/                # Static lookup data (e.g. error procedures)
├── documents/           # Source documents for RAG ingest
└── app/
    ├── core/            # config.py (settings), ws_manager.py
    ├── models/          # Pydantic schemas + thread-safe in-memory wrappers
    ├── routers/         # HTTP + WebSocket endpoints
    ├── services/        # Business logic, grouped by subsystem:
    │   ├── telemetry/   #   TSS polling, WS broadcast, warnings
    │   ├── navigation/  #   Pathfinding, autonomous drive, vision, DUST stream
    │   ├── rag/         #   Ollama, document ingest, whisper, procedures
    │   └── example/     #   Reference implementation for new TSS reads
    └── db/
        ├── database.py  # MongoDB connection
        └── repositories/# DB CRUD classes
```

### Layer responsibilities

- **`routers/`** — receive request, call service, return response. No logic.
- **`services/`** — all business logic; reads telemetry, calls repositories, runs algorithms.
- **`models/`** — Pydantic schemas + wrapper classes holding parsed data behind an `asyncio.Lock`.
- **`db/repositories/`** — only place that touches MongoDB.
- **`core/`** — app-wide settings (`config.py`) and the shared `WebSocketManager`.

Rule: a layer only depends on the layer directly below it.

---

## 3. Networking & Standards

### Protocols

| Direction | Protocol | Used for |
| --- | --- | --- |
| Server → TSS | **UDP** (host/port from `.env`) | Polling rover/EVA/LTV telemetry every `POLL_INTERVAL`s |
| Server ↔ Client | **HTTP/JSON** | Request/response endpoints (procedures, locations, ollama, etc.) |
| Server → Client | **WebSocket** | Live push of telemetry, warnings, navigation, CV results |
| Server ↔ Ollama | **HTTP** (`OLLAMA_URL`) | LLM + embedding calls |
| Server ↔ DUST | **WebSocket** (`DUST_CV_WS_URL`) | LiDAR / point-cloud stream consumed by CV |

### WebSocket channels

Mounted from [main.py](../server/main.py):

```
ws://localhost:8000/ws/telemetry      # full snapshot, every poll cycle
ws://localhost:8000/ws/warnings       # range-check violations
ws://localhost:8000/ws/navigation     # path + nav state
ws://localhost:8000/ws/rover_control  # control commands
ws://localhost:8000/ws/dust_cv        # CV/obstacle detections
```

All WebSocket payloads are JSON, matching the Pydantic models in `app/models/`.

### HTTP conventions

- Base URL: `http://localhost:8000`
- Methods: `GET`, `POST`, `PATCH`, `OPTIONS` (set in CORS middleware)
- CORS: dev allows **only** `http://localhost:5173`
- Responses are JSON (`JSONResponse` or auto-serialized Pydantic models)
- Route prefixes follow the domain name (`/locations/...`, `/procedures/...`, `/ollama/...`)

### Coding standards

- **Async everywhere** — all I/O (UDP, WS, DB, HTTP) uses `async`/`await`; blocking calls are offloaded with `asyncio.to_thread`.
- **Layered access** — routers never touch the TSS, DB, or models directly. Services are the only callers.
- **Thread safety** — in-memory telemetry objects guard state with `asyncio.Lock`; never read `_data` directly.
- **Config via env** — every tunable lives in `app/core/config.py` and is overridable through `server/.env`. No hard-coded hosts, ports, or model names.
- **Validation at the boundary** — every TSS response and request body is parsed through a Pydantic model before reaching service logic.
- **Lint/format** — `ruff` (configured in `pyproject.toml`); run before committing.
- **Commits** — Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`).
