from typing import Literal, Self

from pydantic import BaseModel, model_validator

Verdict = Literal["pass", "issue"]


class Review(BaseModel):
    """One reviewer's verdict on a trace, stored in MLflow as trace feedback."""

    verdict: Verdict
    # "issue": what's wrong (always set). "pass": an optional note on what's good.
    comment: str | None
    reviewer: str
    updated_time_ms: int


class ReviewInput(BaseModel):
    verdict: Verdict
    comment: str | None = None

    @model_validator(mode="after")
    def _check_comment(self) -> Self:
        comment = (self.comment or "").strip()
        if self.verdict == "issue" and not comment:
            raise ValueError("Describe the issue")
        # A pass note is optional; a blank one is no note at all.
        self.comment = comment or None
        return self
