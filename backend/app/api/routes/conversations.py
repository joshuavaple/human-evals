from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_trace_repository
from app.repositories.mlflow_repo import MlflowTraceRepository
from app.schemas import ConversationPage

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ConversationPage)
def list_conversations(
    repo: Annotated[MlflowTraceRepository, Depends(get_trace_repository)],
    max_results: Annotated[int, Query(ge=1, le=200)] = 20,
) -> ConversationPage:
    return repo.list_conversations(max_results=max_results)
