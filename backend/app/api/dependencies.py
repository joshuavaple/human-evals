from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.config import get_settings
from app.repositories.mlflow_repo import MlflowRepository


@lru_cache
def get_repository() -> MlflowRepository:
    settings = get_settings()
    return MlflowRepository(settings.databricks_profile, settings.experiment_folder)


Repo = Annotated[MlflowRepository, Depends(get_repository)]
