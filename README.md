# OWL-SUITS-2026-PR
Rice University's 2026 pressurized rover interface for the NASA SUITS Challenge.


# Dev Environment Guide

## Quickstart
Our application has a back-end (contained in [`/server`](/server) folder) and a front-end (contained in [`/client`](/client) folder).

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) VS Code extension.
2. Clone the repo.
3. Open the repo in VS Code, then when prompted click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
4. Wait for the build — subsequent opens are much faster. Dependencies are installed automatically via `postCreateCommand`.
5. Open a terminal window, and start running the backend server with FastAPI
```bash
cd server
uv run fastapi dev main.py --host 0.0.0.0
```
6. Open another terminal window, and start running the frontend client with React
```bash
cd client
npm run dev
```

The API will be available at `http://localhost:8000` and the frontend at `http://localhost:5173` (open this in your browser).

You can navigate to different routes configured in the frontend by adding the route name at the end of the URL.

For example, we have a `tss_example` route, so go to `http://localhost:5173/tss_example` to open this page.

## Overview

This project uses a **Docker Compose** setup with a **VS Code Dev Container** so every developer gets an identical environment with no manual setup. When you open the project in VS Code and reopen it in the container, a single `dev` container is started and VS Code attaches to it. Both the Python backend and React frontend run inside this one container, and you can edit the full monorepo from a single VS Code window.

---

## Tech Stack

### Frontend (`/client`)

| Layer      | Technology     |
| ---------- | -------------- |
| Language   | TypeScript     |
| Framework  | React 19       |
| Routing    | React Router 7 |
| Build Tool | Vite 7         |
| Runtime    | Node 24        |

### Backend (`/server`)

| Layer           | Technology  |
| --------------- | ----------- |
| Framework       | FastAPI     |
| Package Manager | uv          |
| Language        | Python 3.13 |

---

## How It Works

### Docker Compose Services

A single container runs both services:

- **`dev`** — A combined environment built from `.devcontainer/Dockerfile`, based on `ghcr.io/astral-sh/uv:python3.13-bookworm-slim` with Node 24 installed. The container starts with `sleep infinity` so you can launch services manually from the integrated terminal.

The entire monorepo root is mounted into the container at `/workspace`, so all changes are reflected live without rebuilding.

### Dev Container

The `.devcontainer/devcontainer.json` config tells VS Code to attach to the `dev` container and set the workspace to `/workspace` (the monorepo root).

On first launch, `postCreateCommand` automatically runs:

```bash
cd /workspace/server && uv sync
cd /workspace/client && npm ci
```

VS Code extensions for Python, Pylance, Ruff, ESLint, Prettier, and Docker are installed automatically.

Ports are forwarded automatically:

- `8000` → FastAPI (notification on open)
- `5173` → Vite (opens in browser automatically)

---


---

## Adding Packages

### Frontend (Node / npm)

Open a terminal in VS Code and run from the `/client` directory:

```bash
cd /workspace/client
npm install <package-name>
```

For dev-only dependencies:

```bash
npm install -D <package-name>
```

This updates `package.json` and `package-lock.json`. Commit both files.

### Backend (Python / uv)

Open a terminal in VS Code and run from the `/server` directory:

```bash
cd /workspace/server
uv add <package-name>
```

For dev-only dependencies (e.g. testing tools):

```bash
uv add --dev <package-name>
```

This updates `pyproject.toml` and `uv.lock`. Commit both files.

> **Note:** After adding packages, the changes are live immediately inside the running container thanks to the volume mounts. You do not need to rebuild the container unless you are setting up a fresh environment.

---

## Project Structure

```
repo-root/
├── .devcontainer/
│   ├── Dockerfile          # Single dev container image (Python 3.13 + Node 24)
│   └── devcontainer.json
├── client/                 # React frontend
│   ├── Dockerfile.prod
│   ├── .gitignore
│   ├── .dockerignore
│   └── ...
├── server/                 # FastAPI backend
│   ├── Dockerfile
│   ├── .gitignore
│   ├── .dockerignore
│   ├── pyproject.toml
│   ├── uv.lock
│   └── ...
└── docker-compose.yml
```
