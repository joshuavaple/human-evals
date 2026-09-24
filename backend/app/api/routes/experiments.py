from fastapi import APIRouter

from app.api.dependencies import Repo
from app.schemas import ExperimentList, ExperimentSummary

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.get("", response_model=ExperimentList)
def list_experiments(repo: Repo) -> ExperimentList:
    return repo.list_experiments()


@router.get("/{experiment_id}", response_model=ExperimentSummary)
def get_experiment(experiment_id: str, repo: Repo) -> ExperimentSummary:
    return repo.get_experiment(experiment_id)
