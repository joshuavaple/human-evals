from pydantic import BaseModel


class ExperimentSummary(BaseModel):
    experiment_id: str
    name: str  # last path segment, e.g. "chatbot-smart"
    path: str  # full workspace path, e.g. "/Shared/chatbot-smart"
    location: str  # folder containing it, e.g. "/Shared"
    created_by: str | None  # creator's email, as shown in Databricks' "Created by" column
    last_update_time_ms: int | None


class ExperimentList(BaseModel):
    """Experiments directly inside `folder`, most recently updated first."""

    folder: str
    experiments: list[ExperimentSummary]
