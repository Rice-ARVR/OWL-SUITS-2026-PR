# Server Architecture Guide

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
        ├── models.py              # Beanie document definitions (collection schemas)
        └── repositories/          # Database read/write operations
```

---

## Layers Explained

### `routers/` — What React Talks To

Routers define the HTTP endpoints that the React frontend calls. Their only job is to receive a request, hand it to a service, and return the response. They contain no logic.

```python
# routers/telemetry.py
@router.get("/biometrics")
def get_biometrics():
    return telemetry_service.get_biometrics()
```

Each file in `routers/` maps to a domain (e.g. `telemetry.py`, `navigation.py`). All routers are registered in `main.py` with a URL prefix.

---

### `services/` — Business Logic and SUITS Server Calls

Services are the brain of the backend. They make HTTP requests to the external SUITS telemetry server, parse the raw responses, apply any business rules, and return clean data to the router.

```python
# services/telemetry_service.py
def get_biometrics():
    raw = requests.get("http://suits-server/biometrics").json()
    reading = BiometricReading(heart_rate=raw["hr"], oxygen_level=raw["o2"])
    telemetry_repo.save_reading(reading)
    return reading
```

Services know nothing about HTTP routing. Routers know nothing about the SUITS server. Each layer has one job.

---

### `models/` — Data Shape Definitions

Models are Pydantic classes that define the shape of data at API boundaries. They validate incoming request data and guarantee the shape of outgoing responses to React.

```python
# models/telemetry.py
class BiometricReading(BaseModel):
    heart_rate: int
    oxygen_level: float
    suit_pressure: float
    timestamp: datetime
```

These are not database models — they are contracts between layers that define what data looks like as it moves through the system.

---

### `db/` — Database Layer

Everything database-related lives here.

**`db/database.py`** sets up the MongoDB connection using Motor/Beanie:

```python
async def init_db():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    await init_beanie(database=client.db, document_models=[TelemetryRecord])
```

**`db/models.py`** defines Beanie document classes — these map Python classes to MongoDB collections:

```python
class TelemetryRecord(Document):
    heart_rate: int
    timestamp: datetime

    class Settings:
        name = "telemetry"  # MongoDB collection name
```

**`db/repositories/`** contains the actual read/write operations. Services call repositories instead of touching the database directly:

```python
# db/repositories/telemetry_repo.py
async def save_reading(reading: TelemetryRecord):
    await reading.insert()

async def get_latest_reading():
    return await TelemetryRecord.find_one(sort=[("timestamp", -1)])
```

---

### `core/` — Configuration

Holds app-wide settings loaded from environment variables — things like the SUITS server URL, MongoDB URI, and port configuration. Nothing should be hardcoded; it should be read from here.

---

## Data Flow

```
React Frontend
      │  HTTP request
      ▼
routers/          validates request shape using models/
      │
      ▼
services/         applies logic, calls SUITS telemetry server
      │
      ├──────────────────────────────► SUITS Telemetry Server (external HTTP)
      │
      ▼
db/repositories/  reads and writes to MongoDB
      │
      ▼
db/models.py      Beanie documents mapped to MongoDB collections
```

---

## Adding a New Domain

When adding a new feature (e.g. navigation), create a file in each relevant layer:

1. `models/navigation.py` — define the data shapes
2. `routers/navigation.py` — define the endpoints
3. `services/navigation_service.py` — implement the logic
4. `db/repositories/navigation_repo.py` — implement DB operations (if needed)
5. Register the router in `main.py` with `app.include_router(...)`
