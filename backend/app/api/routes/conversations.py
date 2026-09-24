from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import Repo
from app.schemas import ConversationPage

router = APIRouter(prefix="/experiments/{experiment_id}/conversations", tags=["conversations"])


@router.get("", response_model=ConversationPage)
def list_conversations(
    experiment_id: str,
    repo: Repo,
    max_results: Annotated[int, Query(ge=1, le=200)] = 20,
) -> ConversationPage:
    return repo.list_conversations(experiment_id, max_results=max_results)
