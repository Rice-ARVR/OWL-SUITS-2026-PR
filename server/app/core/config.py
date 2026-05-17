from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TSS_HOST: str
    TSS_PORT: int = 14141
    TSS_TIMEOUT: float = 2.0
    POLL_INTERVAL: float = 1.0

    # Obstacle-avoidance algorithm used by the autonomous mission loop's
    # waypoint traversal: "lidar" (auto_drive) or "cv" (auto_drive_vision).
    NAV_TRAVEL_ALGORITHM: Literal["lidar", "cv"] = "cv"
    OLLAMA_URL: str = "http://host.docker.internal:11434"
    EMBED_MODEL: str = "nomic-embed-text"
    AIA_MODEL: str = "llama3.2"

    DUST_CV_WS_URL: str = "ws://host.docker.internal:8766"

    CV_MODEL_PRIMARY: str = "yolo26_small_v2.pt"
    CV_MODEL_SECONDARY: str = "yolo26_nano_v2.pt"

    MONGODB_URL: str
    MONGO_DB: str = "app"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
