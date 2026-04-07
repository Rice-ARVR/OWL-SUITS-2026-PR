# Dev Environment Guide
## TSS+DUST Setup
The Telemetry Stream Server (TSS) is the centralized server for sending/receiving data for the SUITS challenge. You can read more about it [here](https://github.com/SUITS-Techteam/TSS2026#introduction).
You MUST set this up locally before doing anything with our codebase.

### Setting up WSL2 (**WINDOWS ONLY**)
TSS only runs on Unix-based systems (e.g., Linux, or Mac). If you have a Mac, skip this section.
To run TSS on Windows, we'll need to install Windows Subsystem for Linux 2 (WSL2). It's basically Linux on Windows.
1. Open PowerShell as Administrator.
2. Run the following command: `wsl --install Ubuntu-24.04`.
3. Restart your computer.

Now you have WSL2 installed. To open it, type "WSL" in the Windows search bar (it has a penguin icon).

On first boot, WSL will ask you to set a username and password. This is your Linux username and password. Set them to ones you'll remember.

Once you see the boot page of WSL below, WSL and Ubuntu is successfully setup.
<img width="1729" height="926" alt="image" src="https://github.com/user-attachments/assets/c4b88f24-382d-4c8c-999d-7e3a7136a49b" />

Now, let's install GCC, which we'll need to build the TSS server.

4. Run the following commands
```bash
sudo apt-get update
sudo apt-get install
sudo apt-get install build-essential gdb
```
5. Verify that G++ and GDB (components of GCC) were installed properly
```bash
whereis g++
whereis gdb
```
You should see something like this if installed properly:
<img width="1226" height="146" alt="image" src="https://github.com/user-attachments/assets/df70ad22-334f-47ee-baa0-c698fbec7a65" />


### Downloading & Building & Running TSS
*(If you wanna know what these commands (e.g., `cd`, `ls`, `mkdir`) do, read [this](https://www.geeksforgeeks.org/linux-unix/basic-linux-commands/))*
1. Navigate to your home directory: `cd ~`
2. Clone the TSS repository: `git clone https://github.com/SUITS-Techteam/TSS2026.git`
3. Navigate to the TSS repository: `cd TSS2026`
4. Give the build script executable permission: `chmod +x ./build.bat`
5. Build the TSS server: `./build.bat`
6. Start the TSS server: `./server.exe`

If done successfully, you should see the following lines appear. Make note of the IP on the 1st line, as we'll need that later.
```
Launching Server at IP: 172.20.XX.XX:14141
Configuring Local Address...
Creating HTTP Socket...
Binding HTTP Socket...
Listening to HTTP Socket...
Creating UDP Socket...
Binding UDP Socket...
Listening to UDP Socket...
Backend and simulation engine initialized successfully
```

7. Test that you can reach the TSS server successfully by navigating to the TSS dashboard by pasting the IP address into your browser. You should see the dashboard like so:
<img width="2559" height="1358" alt="image" src="https://github.com/user-attachments/assets/9838fa8c-4f96-44c3-a035-e776b8e96228" />

### DUST Setup (WINDOWS ONLY)
DUST is the Lunar simulation that runs the rover we are controlling. You can read more about it [here](https://github.com/SUITS-Techteam/TSS2026#dust-simulation).
If you have a Mac, then you can't run DUST at the moment. We are currently figuring out how to run it on Mac.

**Ensure you are running TSS before installing or running DUST!**
1. Download DUST [here](https://nasagov.app.box.com/s/480nvf36rb84fxcby5bufvba8a41dydy/file/2154228678542) (latest version 1.1 as of 4/7/26)
2. Extract the downloaded .zip file.
3. Open `SUITS_DUST.exe` in the root of the extracted folder contents.
4. Paste the IP you wrote down from TSS step 6 (**remove the port, aka the `:14141` part**) into the input box, and click Connect.
<img width="2137" height="1381" alt="image" src="https://github.com/user-attachments/assets/bcc76295-24ad-4eb3-b890-d2ff85ca0283" />
5. If all went well, you should be seeing a simulation of the lunar south pole like below! Read [this](https://github.com/SUITS-Techteam/TSS2026#controls) for debug rover controls.

<img width="2134" height="1381" alt="image" src="https://github.com/user-attachments/assets/32fed836-4a45-4e65-a460-806e51b696d4" />



## Setting up our rover interface for development
Our interface has a back-end (contained in [`/server`](/server) folder) and a front-end (contained in [`/client`](/client) folder).
- back-end handles all TSS connections, navigation algos, telemetry data, warnings, and other backend logic
- front-end actually runs our interface website

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

You are now ready to start working with our codebase! Feel free to continue reading if you're interested in learning how our dev environment is set up.

---

# Dev Environment Overview (_optional_)

This project uses a **Docker Compose** setup with a **VS Code Dev Container** so every developer gets an identical environment with no manual setup. When you open the project in VS Code and reopen it in the container, a single `dev` container is started and VS Code attaches to it. Both the Python backend and React frontend run inside this one container, and you can edit the full monorepo from a single VS Code window.

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

