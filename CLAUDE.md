# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo for a **NASA SUITS 2026 Pressurized Rover (PR) interface** — a multi-monitor display system. The app streams live telemetry from the SUITS Telemetry Simulation Server (TSS) over UDP to a React frontend via a FastAPI backend.

## Commands

### Frontend (`/client`)
```bash
npm run dev        # Start Vite dev server (port 5173)
npm run build      # Production build
npm run typecheck  # TypeScript check + generate React Router types
```

### Backend (`/server`)
```bash
uv sync                                              # Install dependencies
uv run fastapi dev main.py --host 0.0.0.0           # Start dev server (port 8000)
uv add <package>                                     # Add runtime dependency
uv add --dev <package>                               # Add dev dependency
```

### Docker
```bash
docker compose up   # Run full stack (recommended for first setup)
```

## Architecture

### Data Flow
```
React (port 5173) → fetch("/endpoint")
    → FastAPI Router (port 8000)
    → Service (business logic)
    → Telemetry objects (in-memory, thread-safe with asyncio.Lock)
    → TSS polling loop (UDP every 1s) ← external TSS server
    → MongoDB (persistence via repositories)
```

### Backend Layers (`/server/app/`)
- **`routers/`** — HTTP endpoints only; receive request, call service, return response
- **`services/`** — Business logic; reads from telemetry models
- **`models/`** — Pydantic schemas with async getter methods and `asyncio.Lock` for thread safety
- **`db/`** — MongoDB connection + repository CRUD classes
- **`core/config.py`** — All settings loaded from environment via `pydantic-settings`

TSS polling is in `services/telemetry/telemetry_service.py` — a background async loop that queries TSS via UDP and updates in-memory model objects.

### Frontend Layers (`/client/app/`)
- **`routes/`** — Thin entry points that delegate to feature components
- **`features/`** — Self-contained per monitor: `map/`, `navigation/`, `task-board/`, `examples/`
- **`components/ui/`** — Shared components only when used across 2+ features
- **`lib/`** — Pure TypeScript utilities (no JSX, no hooks); `api.ts` for fetch wrappers
- **`types/`** — Shared TypeScript interfaces

Route configuration is centralized in `routes.ts`. Path alias `~/*` maps to `./app/*`.

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

## Adding a New TSS Feature

Follow the 7-step pattern in `docs/example.md`:
1. Add Pydantic model in `server/app/models/`
2. Add TSS command constant and polling call in `telemetry_service.py`
3. Create service in `server/app/services/`
4. Create router in `server/app/routers/` and register in `main.py`
5. Add route in `client/app/routes.ts`
6. Create route file in `client/app/routes/`
7. Create feature component in `client/app/features/`

## Git Workflow

- **Branch naming**: `{issue-number}-{kebab-case-description}` (e.g., `7-warning-system`)
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.)
- **PRs**: Squash-and-merge into `main`; link to GitHub Projects issue
- **CORS**: Dev server only allows `http://localhost:5173`
