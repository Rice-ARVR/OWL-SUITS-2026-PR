# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo for a **NASA SUITS 2026 Pressurized Rover (PR) interface** — a multi-monitor display system. The app streams live telemetry from the SUITS Telemetry Simulation Server (TSS) over UDP to a React frontend via a FastAPI backend, delivered to clients via WebSocket.

## Commands

### Frontend (`/client`)
```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run typecheck    # TypeScript check + generate React Router types
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
npm test             # Vitest
```

### Backend (`/server`)
```bash
uv sync                                         # Install dependencies
uv run fastapi dev main.py --host 0.0.0.0      # Start dev server (port 8000)
uv add <package>                                # Add runtime dependency
uv add --dev <package>                          # Add dev dependency
```

### Docker
```bash
docker compose up   # Run full stack (recommended for first setup)
```

## Architecture

### Data Flow

Telemetry is **pushed via WebSocket**, not polled over HTTP:

```
TSS (UDP, every 1s)
    │
    ▼
services/telemetry/telemetry_service.py   ← polls TSS, updates in-memory data objects
    │  _poll_once() completes
    ├──► services/telemetry/telemetry_ws_service.py  → ws://localhost:8000/ws/telemetry
    │         ▼
    │    client/app/lib/telemetryManager.ts  ← singleton, caches latest snapshot
    │         ▼
    │    client/app/hooks/useTelemetry.ts   ← re-renders component on new data
    │
    ├──► services/telemetry/warning_service.py  → ws://localhost:8000/ws/warnings
    │         ▼
    │    root.tsx warnings overlay
    │
    └──► services/rag/context_builder.py   ← writes context file for RAG queries

React (non-telemetry) → HTTP fetch → routers/ → services/ → db/repositories/ → MongoDB
```

### Backend Layers (`/server/app/`)
- **`routers/`** — HTTP endpoints only; receive request, call service, return response. Registered in `main.py` with `app.include_router(...)`.
- **`services/`** — Business logic; reads from telemetry models or DB repositories
- **`services/telemetry/`** — `telemetry_service.py` (polling loop + global data objects), `telemetry_ws_service.py` (WebSocket broadcast), `warning_service.py` (range checks + warning broadcast), `tss_client.py` (low-level UDP)
- **`models/`** — Pydantic schemas (`eva.py`, `rover.py`, `ltv.py`, `ltv_errors.py`) plus wrapper classes with `asyncio.Lock` for thread-safe in-memory storage and async getters
- **`db/`** — MongoDB connection (`database.py`) + repository CRUD classes
- **`core/config.py`** — All settings loaded from environment via `pydantic-settings`

### Frontend Layers (`/client/app/`)
- **`routes/`** — Thin entry points: handle `loader`/`action` if needed, then delegate to feature component
- **`features/`** — Self-contained per monitor (`map/`, `navigation/`, `task-board/`). Feature-specific components, subcomponents, and hooks live here. Only promote to `components/` when genuinely used by 2+ features.
- **`components/ui/`** — Shared primitive components only
- **`hooks/useTelemetry.ts`** — Subscribes to `TelemetryManager` singleton, triggers re-renders on new data
- **`lib/telemetryManager.ts`** — Singleton WebSocket connection, data cache, typed `get*()` getters; pure TypeScript (no JSX/hooks)
- **`types/telemetry.ts`** — Full snapshot shape mirroring backend Pydantic schemas
- **`types/warning.ts`** — Warning type for `/ws/warnings` messages

Route configuration is centralized in `routes.ts`. Path alias `~/*` maps to `./app/*`. Styling uses CSS Modules (`.module.css` co-located with each component); global tokens defined in `app.css`.

## Reading Telemetry in a Component

Use the `useTelemetry` hook — no `useEffect`, no `fetch`, no state management needed:

```tsx
const telemetry = useTelemetry();
if (!telemetry.isReady()) return <p>Connecting...</p>;
const hr = telemetry.getEva1HeartRate()?.toFixed(2) ?? "—";
```

Available getters are on `TelemetryManager` in `client/app/lib/telemetryManager.ts`. If a getter is missing, add it there — the full data shape is in `client/app/types/telemetry.ts`.

## Adding a Telemetry Read Feature (frontend only)

1. Create `client/app/features/<name>/<Name>.tsx` — use `useTelemetry()` to read data
2. Create `client/app/features/<name>/<Name>.module.css`
3. Create `client/app/routes/<name>.tsx` — thin wrapper that renders the feature component
4. Register the route in `client/app/routes.ts`

No backend changes needed — `/ws/telemetry` already broadcasts the full snapshot.

## Adding a Non-Telemetry Backend Feature

For write operations, DB operations, or custom algorithms:

1. `server/app/models/<name>.py` — Pydantic schemas + async wrapper class
2. `server/app/services/<name>_service.py` — business logic
3. `server/app/routers/<name>.py` — endpoints, register in `main.py`
4. `server/app/db/repositories/<name>_repo.py` — DB operations (if needed)

## Environment Setup

**`server/.env`**:
```
TSS_HOST=<rover_network_ip>
TSS_PORT=14141
TSS_TIMEOUT=2.0
POLL_INTERVAL=1.0
MONGODB_URL=mongodb://...
MONGO_DB=app
```

**`client/.env`**:
```
VITE_API_URL=http://localhost:8000
```

## Git Workflow

- **Branch naming**: `type/issuenum-description-netid` (e.g., `feat/67-warning-system-ab123`)
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`)
- **PRs**: Squash-and-merge into `main`; PR title becomes the single commit message on `main`
- **Updating branch**: rebase off `main` (`git rebase origin/main`), not merge
- **CORS**: Dev server only allows `http://localhost:5173`