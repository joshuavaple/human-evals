from typing import Any

from pydantic import BaseModel


class TraceSummary(BaseModel):
    """A trace as shown in the review queue. Previews are truncated by MLflow."""

    trace_id: str
    session_id: str | None  # MLflow conversation (session) ID, if the agent logged one
    request_time_ms: int
    state: str
    execution_duration_ms: int | None
    request_preview: str | None
    response_preview: str | None


class TracePage(BaseModel):
    traces: list[TraceSummary]
    next_page_token: str | None


class Conversation(BaseModel):
    """All traces sharing one session ID, oldest turn first.

    Traces logged without a session ID become single-turn conversations with
    session_id = None, so they still show up.
    """

    session_id: str | None
    latest_request_time_ms: int
    traces: list[TraceSummary]


class ConversationPage(BaseModel):
    """Conversations with the most recent activity first."""

    conversations: list[Conversation]
    # True when older conversations exist; ask again with a larger max_results.
    has_more: bool


class TraceDetail(TraceSummary):
    """A single trace with full inputs and outputs of the root span."""

    request: Any
    response: Any
