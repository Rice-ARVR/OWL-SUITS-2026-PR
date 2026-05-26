# Pressurized Rover Intelligence Platform (OWL SUITS 2026)

Rice University's submission for the [NASA SUITS 2026 Challenge](https://www.nasa.gov/learning-resources/spacesuit-user-interface-technologies-for-students/).

NASA SUITS (Spacesuit User Interface Technologies for Students) is a challenge that tasks university teams with designing and building software interfaces for astronaut spacesuits and rovers. For the 2026 competition, we built a Pressurized Rover Intelligence Platform — a three-screen display system that helps astronauts autonomously navigate the lunar south pole during Artemis missions and search for a damaged Lunar Terrain Vehicle (LTV).

The interface is designed to reduce astronaut cognitive load during high-stakes tasks. We validate this through human-in-the-loop testing grounded in human factors research, measuring how interface design choices affect operator performance and mental workload.

Our design was selected as one of the top 5 PR designs in the nation, earning us the opportunity to test our interface in person at the Johnson Space Center.

## Features

### Telemetry Dashboard
Live monitoring of EV and PR telemetry, dynamic warning system, and trend graphs.

https://github.com/user-attachments/assets/docs/media/telemetry_demo.mp4

---

### Dynamic Map & LTV Search
Dynamic map displaying hazards and projected path. Autonomous LTV search using location pings and gradient ascent.

https://github.com/user-attachments/assets/docs/media/map_interactions_demo.mp4

https://github.com/user-attachments/assets/docs/media/ltv_search_demo.mp4

---

### AI Assistant
RAG system with deep integration into mission procedures and telemetry warning handling. Supports voice control and widget generation for fast visual feedback.

https://github.com/user-attachments/assets/docs/media/aia_demo.mp4

---

### Autonomous Navigation
Computer vision pipeline using a fine-tuned YOLOv26s model to identify obstacles like craters and boulders. Automatic obstacle avoidance and steering to target position, deeply integrated with manual controls to keep humans in the loop.

https://github.com/user-attachments/assets/docs/media/auto_nav_demo.mp4

## Documentation

- [Frontend Guide](docs/frontend.md)
- [Backend Guide](docs/backend.md)
- [Dev Guide](docs/dev-guide.md)
- [GitHub Workflow](docs/github.md)
- [Example](docs/example.md)

## Proposal

- [Proposal](docs/proposal.pdf)

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/) with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
- [Ollama](https://ollama.com/) (Ollama 3.2, Gemma 4, nomic-embed-text)
- [DUST](https://software.nasa.gov/software/MSC-27522-1)
- [PR-Tools](https://github.com/Rice-ARVR/PR-Tools) Stream Server Required for Teleop
- [MongoDB+](https://www.mongodb.com/)

### Setup

1. Clone the repo.
2. Open the repo in VS Code, then when prompted click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
3. Wait for the build — subsequent opens are much faster. Dependencies are installed automatically.
4. Add .env to client folder
5. Add .env to server folder

### Running the App+

Start the backend:

```bash
cd server
uv run fastapi dev main.py --host 0.0.0.0
```

Start the frontend:

```bash
cd client
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:8000`.
