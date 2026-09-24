from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HUMAN_EVALS_", env_file=".env", extra="ignore")

    # Profile in ~/.databrickscfg. U2M auth: log in once with `databricks auth login --profile X`.
    databricks_profile: str
    # Workspace folder whose experiments can be browsed, e.g. /Shared or /Users/me@example.com
    experiment_folder: str = "/Shared"
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
