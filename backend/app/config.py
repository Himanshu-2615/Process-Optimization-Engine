"""Application configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    DATABASE_URL: str = "sqlite:///./process_optimizer.db"
    REDIS_URL: str | None = None
    DEBUG: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
