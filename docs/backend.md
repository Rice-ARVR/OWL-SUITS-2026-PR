# Server Architecture Guide

## Environment Setup

Before running the server, create a `.env` file inside the `server/` folder:

```
server/.env
```

Required variables:

```
TSS_HOST=172.31.xxx.xx
MONGODB_URL=mongodb://...
```

All settings are loaded via `app/core/config.py`:

```python
# app/core/config.py
class Settings(BaseSettings):
    TSS_HOST: str
    TSS_PORT: int = 14141
    TSS_TIMEOUT: float = 2.0
    POLL_INTERVAL: float = 1.0

    MONGODB_URL: str
    MONGO_DB: str = "app"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

---

## Overview

The server is a **FastAPI** application organized in a layered architecture similar to MVC (Model-View-Controller). Each layer has a single, clearly defined responsibility. The React frontend never talks to the database or the SUITS telemetry server directly — all of that goes through this server.

---

## Folder Structure

```
server/
├── main.py                        # Entry point — creates the app and registers routers
├── pyproject.toml                 # Python dependencies
└── app/
    ├── core/                      # App-wide configuration and settings
    ├── models/                    # Pydantic schemas (data shape definitions)
    ├── routers/                   # Endpoints the React frontend calls
    ├── services/                  # Business logic and SUITS telemetry server calls
    └── db/
        ├── database.py            # MongoDB connection setup
        └── repositories/          # Database read/write operations
```

---

## `main.py` — Entry Point

Creates the FastAPI app, registers middleware, wires up the database and polling lifecycle, and includes all routers:

```python
# main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    connect()
    await start_polling()
    yield
    await stop_polling()
    disconnect()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
)

# Include Routers Here:
app.include_router(tss_example_router)
app.include_router(locations_router)
```

---

## Layers Explained

### `routers/` — What React Talks To

Routers define the HTTP endpoints that the React frontend calls. Their only job is to receive a request, hand it to a service, and return the response. They contain no logic.

```python
# app/routers/locations.py
router = APIRouter()

@router.get("/locations/rover")
async def get_rover_current_location():
    data = await get_rover_location()
    return JSONResponse(data)

@router.get("/locations/eva")
async def get_eva_current_locations():
    data = await get_eva_locations()
    return JSONResponse(data)
```

Each file in `routers/` maps to a domain (e.g. `tss_example.py`, `locations.py`). All routers are registered in `main.py` with `app.include_router(...)`.

---

### `services/` — Business Logic

Services are the brain of the backend. They read from the in-memory telemetry data objects and return clean, structured data to the router.

```python
# app/services/locations_service.py
async def get_rover_location() -> dict:
    return {
        "x": await telemetry_service.rover_data.get_pr_rover_pos_x(),
        "y": await telemetry_service.rover_data.get_pr_rover_pos_y(),
        "z": await telemetry_service.rover_data.get_pr_rover_pos_z(),
    }

async def get_eva_locations() -> dict:
    return {
        "eva1": {
            "x": await telemetry_service.eva_data.get_imu_eva1_posx(),
            "y": await telemetry_service.eva_data.get_imu_eva1_posy(),
        },
        "eva2": {
            "x": await telemetry_service.eva_data.get_imu_eva2_posx(),
            "y": await telemetry_service.eva_data.get_imu_eva2_posy(),
        },
    }
```

Services know nothing about HTTP routing. Routers know nothing about the TSS server. Each layer has one job.

---

### `models/` — Data Shape Definitions

Models are Pydantic classes that define the shape of data at API boundaries. They validate incoming TSS responses and guarantee the shape of data moving through the system.

```python
# app/models/eva.py
class Eva1Telemetry(BaseModel):
    primary_battery_level: float
    secondary_battery_level: float
    oxy_pri_storage: float
    oxy_sec_storage: float
    suit_pressure_oxy: float
    suit_pressure_total: float
    heart_rate: float
    temperature: float
    coolant_storage: float
    eva_elapsed_time: float
    # ... and more fields
```

Each model file also contains a **wrapper class** that holds the parsed data in memory and exposes async getter methods with a lock for thread safety:

```python
# app/models/eva.py
class EvaData:
    def __init__(self) -> None:
        self._data: EvaSchema | None = None
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update(self, raw: dict) -> None:
        parsed = EvaSchema.model_validate(raw)
        async with self._lock:
            self._data = parsed

    async def get_eva1_heart_rate(self) -> float | None:
        async with self._lock:
            return self._data.telemetry.eva1.heart_rate if self._data else None
```

---

### `services/telemetry/` — TSS Polling

The telemetry service runs a background loop that polls the SUITS Telemetry Simulation Server (TSS) over UDP once per `POLL_INTERVAL` and updates the in-memory data objects.

**`tss_client.py`** — Low-level UDP communication:

```python
# app/services/telemetry/tss_client.py
COMMAND_ROVER = 0
COMMAND_EVA = 1
COMMAND_LTV = 2
COMMAND_LTV_ERRORS = 3

def _build_packet(command: int) -> bytes:
    return struct.pack(">II", int(time.time()), command)

async def fetch_json(command: int) -> dict:
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
```

**`telemetry_service.py`** — Polling loop and global data objects:

```python
# app/services/telemetry/telemetry_service.py
eva_data: EvaData | None = None
ltv_data: LtvData | None = None
ltv_errors_data: LtvErrorsData | None = None
rover_data: RoverData | None = None

async def _poll_once() -> None:
    results = await asyncio.gather(
        fetch_json(COMMAND_ROVER),
        fetch_json(COMMAND_EVA),
        fetch_json(COMMAND_LTV),
        fetch_json(COMMAND_LTV_ERRORS),
        return_exceptions=True,
    )
    rover_result, eva_result, ltv_result, ltv_errors_result = results

    if isinstance(rover_result, Exception):
        logger.error("Failed to fetch ROVER data: %s", rover_result)
    else:
        await rover_data.update(rover_result)
    # ... same pattern for eva, ltv, ltv_errors

async def _polling_loop() -> None:
    while True:
        t0 = asyncio.get_event_loop().time()
        await _poll_once()
        elapsed = asyncio.get_event_loop().time() - t0
        await asyncio.sleep(max(0.0, settings.POLL_INTERVAL - elapsed))
```

---

### `db/` — Database Layer

**`db/database.py`** sets up the MongoDB connection using PyMongo:

```python
# app/db/database.py
def connect():
    global client, db
    client = MongoClient(settings.MONGODB_URL)
    client.admin.command("ping")
    db = client[settings.MONGO_DB]
    print(f"Connected to MongoDB (db: {settings.MONGO_DB})")

def disconnect():
    global client
    if client:
        client.close()
```

**`db/repositories/`** is where database read/write operations go. Services call repositories instead of touching the database directly.

---

## Data Flow

```
React Frontend
      │  HTTP request
      ▼
routers/          receives request, calls service
      │
      ▼
services/         reads from in-memory telemetry data objects
      │
      ├──────────────────────────────► TSS Telemetry Server (UDP, polled every 1s)
      │
      ▼
models/           Pydantic schemas + async wrapper classes (thread-safe)
      │
      ▼
db/repositories/  reads and writes to MongoDB
```

---

## Adding a New Domain

When adding a new feature (e.g. navigation), create a file in each relevant layer:

1. `models/navigation.py` — define Pydantic schemas and a wrapper class with async getters
2. `services/navigation_service.py` — implement the logic by reading from telemetry data objects
3. `routers/navigation.py` — define the endpoints and call the service
4. `db/repositories/navigation_repo.py` — implement DB operations (if needed)
5. Register the router in `main.py` with `app.include_router(...)`
