from typing import Any

from pydantic import BaseModel


class TraceSummary(BaseModel):
    """A trace as shown in the review queue. Previews are truncated by MLflow."""

    trace_id: str
    request_time_ms: int
    state: str
    execution_duration_ms: int | None
    request_preview: str | None
    response_preview: str | None


class TracePage(BaseModel):
    traces: list[TraceSummary]
    next_page_token: str | None


class TraceDetail(TraceSummary):
    """A single trace with full inputs and outputs of the root span."""

    request: Any
    response: Any
