from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_trace_repository
from app.repositories.mlflow_repo import MlflowTraceRepository, TraceNotFoundError
from app.schemas import TraceDetail, TracePage

router = APIRouter(prefix="/traces", tags=["traces"])

Repo = Annotated[MlflowTraceRepository, Depends(get_trace_repository)]


@router.get("", response_model=TracePage)
def list_traces(
    repo: Repo,
    max_results: Annotated[int, Query(ge=1, le=500)] = 50,
    page_token: str | None = None,
) -> TracePage:
    return repo.list_traces(max_results=max_results, page_token=page_token)


@router.get("/{trace_id}", response_model=TraceDetail)
def get_trace(trace_id: str, repo: Repo) -> TraceDetail:
    try:
        return repo.get_trace(trace_id)
    except TraceNotFoundError:
        raise HTTPException(status_code=404, detail=f"Trace not found: {trace_id}") from None
