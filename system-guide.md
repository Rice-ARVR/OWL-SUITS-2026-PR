# Dev Environment Guide

## Overview

This project uses a **Docker Compose** setup with a **VS Code Dev Container** so every developer gets an identical environment with no manual setup. When you open the project in VS Code and reopen it in the container, two services spin up automatically — a Python backend and a React frontend — and VS Code attaches directly into the backend container where you can edit the full monorepo.

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

### Database

| Technology |
| ---------- |
| MongoDB    |

---

## How It Works

### Docker Compose Services

Two containers run in parallel:

- **`server`** — FastAPI app served by Uvicorn with `--reload` for hot reloading. Runs on port `8000`.
- **`client`** — Vite dev server with HMR. Runs on port `5173`.

The entire monorepo root is mounted into the server container at `/workspace`, so you can edit both client and server code from one VS Code window.

### Dev Container

The `.devcontainer/devcontainer.json` config tells VS Code to attach to the `server` container and set the workspace to `/workspace` (the monorepo root). VS Code extensions for Python, ESLint, and Prettier are installed automatically on first launch.

Ports are forwarded automatically:

- `8000` → FastAPI (notification on open)
- `5173` → Vite (opens in browser automatically)

---

## Getting Started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) VS Code extension.
2. Clone the repo.
3. Open the repo in VS Code, then when prompted click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
4. Wait for the build — subsequent opens are much faster.

Both services start automatically. The API is available at `http://localhost:8000` and the frontend at `http://localhost:5173`.

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
│   └── devcontainer.json
├── client/                  # React frontend
│   ├── Dockerfile.dev
│   ├── .gitignore
│   ├── .dockerignore
│   └── ...
├── server/                  # FastAPI backend
│   ├── Dockerfile
│   ├── .gitignore
│   ├── .dockerignore
│   ├── pyproject.toml
│   ├── uv.lock
│   └── ...
└── docker-compose.yml
```
