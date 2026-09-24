from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import Repo
from app.schemas import TraceDetail, TracePage

router = APIRouter(prefix="/experiments/{experiment_id}/traces", tags=["traces"])


@router.get("", response_model=TracePage)
def list_traces(
    experiment_id: str,
    repo: Repo,
    max_results: Annotated[int, Query(ge=1, le=500)] = 50,
    page_token: str | None = None,
) -> TracePage:
    return repo.list_traces(experiment_id, max_results=max_results, page_token=page_token)


@router.get("/{trace_id}", response_model=TraceDetail)
def get_trace(experiment_id: str, trace_id: str, repo: Repo) -> TraceDetail:
    return repo.get_trace(experiment_id, trace_id)
