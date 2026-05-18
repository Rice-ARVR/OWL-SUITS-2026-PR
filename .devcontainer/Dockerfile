# Stage 1: FastAPI server with CUDA support
FROM nvidia/cuda:13.1.2-cudnn-runtime-ubuntu24.04 AS server
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY server/ .
RUN uv sync --frozen --no-dev
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Stage 2: React/Vite frontend
FROM node:24-alpine AS frontend
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: Dev container (Cursor/VS Code)
FROM nvidia/cuda:13.1.2-cudnn-runtime-ubuntu24.04 AS dev
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y git curl \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
