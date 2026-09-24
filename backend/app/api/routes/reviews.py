from fastapi import APIRouter, Response

from app.api.dependencies import Repo
from app.schemas import Review, ReviewInput

router = APIRouter(prefix="/experiments/{experiment_id}/traces/{trace_id}/review", tags=["reviews"])


@router.put("", response_model=Review)
def save_review(experiment_id: str, trace_id: str, review: ReviewInput, repo: Repo) -> Review:
    """Saves the logged-in user's verdict on a trace, replacing their earlier one."""
    return repo.save_review(experiment_id, trace_id, review)


@router.delete("", status_code=204)
def delete_review(experiment_id: str, trace_id: str, repo: Repo) -> Response:
    """Removes the logged-in user's verdict (used by "Undo"). Succeeds if there is none."""
    repo.delete_review(experiment_id, trace_id)
    return Response(status_code=204)
