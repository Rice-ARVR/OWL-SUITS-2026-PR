# Stage 1: Ollama with model baked in
FROM ollama/ollama AS ollama
RUN apt-get update && apt-get install -y curl
RUN /bin/ollama serve & \
    SERVER_PID=$! && \
    until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do \
      echo 'Waiting for Ollama...' && sleep 2; \
    done && \
    ollama pull llama3.2 && \
    kill $SERVER_PID
EXPOSE 11434
CMD ["ollama", "serve"]

# Stage 2: FastAPI server
FROM python:3.13-slim AS server
WORKDIR /app
COPY server/ .
RUN pip install --no-cache-dir "fastapi[standard]>=0.134.0" "pydantic-settings>=2.13.1" "uvicorn>=0.41.0" "httpx"
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Stage 3: React/Vite frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 4: Dev container (Cursor/VS Code)
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS dev
RUN apt-get update && apt-get install -y git curl \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
