# OWL-SUITS-2026-PR

Rice University's pressurized rover interface for the [NASA SUITS 2026 Challenge](https://www.nasa.gov/nasa-suits/).

NASA SUITS (Spacesuit User Interface Technologies for Students) is a challenge that tasks university teams with designing and building software interfaces for astronaut spacesuits and rovers. Our team, OWL, is building the pressurized rover (PR) interface — a dual-monitor display system used inside the rover during simulated lunar surface operations.

The interface is designed to reduce astronaut cognitive load during high-stakes tasks. We validate this through human-in-the-loop testing grounded in HF (human factors) research, measuring how interface design choices affect operator performance and mental workload.

Our design was selected as one of the top 5 PR designs in the nation, earning us the opportunity to test our interface in person at the NASA SUITS challenge.

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

### Setup

1. Clone the repo.
2. Open the repo in VS Code, then when prompted click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
3. Wait for the build — subsequent opens are much faster. Dependencies are installed automatically.

### Running the App

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
