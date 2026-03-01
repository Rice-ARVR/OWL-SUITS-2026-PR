# server/Dockerfile
FROM ghcr.io/astral-sh/uv:python3.13-alpine

RUN apk add --no-cache git  # ← add this

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]