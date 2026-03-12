from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TSS_HOST: str
    TSS_PORT: int = 14141
    TSS_TIMEOUT: float = 2.0
    POLL_INTERVAL: float = 1.0

    MONGODB_URL: str
    MONGO_DB: str = "app"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
