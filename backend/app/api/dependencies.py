from functools import lru_cache

from app.config import get_settings
from app.repositories.mlflow_repo import MlflowTraceRepository


@lru_cache
def get_trace_repository() -> MlflowTraceRepository:
    settings = get_settings()
    return MlflowTraceRepository(settings.databricks_profile, settings.experiment_name)
