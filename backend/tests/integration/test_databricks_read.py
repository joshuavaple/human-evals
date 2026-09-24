"""Read-only checks against a live Databricks workspace.

Run with:  uv run pytest -m integration --profile <profile> --experiment <experiment path>
(or set HUMAN_EVALS_DATABRICKS_PROFILE / HUMAN_EVALS_EXPERIMENT_NAME).
"""

import pytest
from databricks.sdk import WorkspaceClient
from fastapi.testclient import TestClient

from app.api.dependencies import get_trace_repository
from app.config import Settings
from app.main import create_app
from app.repositories.mlflow_repo import (
    ExperimentNotFoundError,
    MlflowTraceRepository,
    TraceNotFoundError,
)

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def profile(request) -> str:
    value = request.config.getoption("--profile")
    if not value:
        pytest.skip("pass --profile or set HUMAN_EVALS_DATABRICKS_PROFILE")
    return value


@pytest.fixture(scope="module")
def experiment(request) -> str:
    value = request.config.getoption("--experiment")
    if not value:
        pytest.skip("pass --experiment or set HUMAN_EVALS_EXPERIMENT_NAME")
    return value


@pytest.fixture(scope="module")
def repo(profile, experiment) -> MlflowTraceRepository:
    return MlflowTraceRepository(profile, experiment)


@pytest.fixture(scope="module")
def first_trace_id(repo) -> str:
    page = repo.list_traces(max_results=1)
    if not page.traces:
        pytest.skip("experiment has no traces")
    return page.traces[0].trace_id


def test_profile_authenticates_with_u2m(profile):
    me = WorkspaceClient(profile=profile).current_user.me()
    assert me.user_name


def test_experiment_resolves(repo):
    assert repo.experiment_id


def test_unknown_experiment_raises(profile):
    repo = MlflowTraceRepository(profile, "/human-evals/definitely-not-an-experiment")
    with pytest.raises(ExperimentNotFoundError):
        _ = repo.experiment_id


def test_list_traces(repo):
    page = repo.list_traces(max_results=5)
    assert len(page.traces) <= 5
    times = [t.request_time_ms for t in page.traces]
    assert times == sorted(times, reverse=True)


def test_list_traces_pagination_has_no_overlap(repo):
    first = repo.list_traces(max_results=1)
    if first.next_page_token is None:
        pytest.skip("experiment has fewer than 2 traces")
    second = repo.list_traces(max_results=1, page_token=first.next_page_token)
    assert second.traces
    assert first.traces[0].trace_id != second.traces[0].trace_id


def test_get_trace_returns_io(repo, first_trace_id):
    detail = repo.get_trace(first_trace_id)
    assert detail.trace_id == first_trace_id
    assert detail.request is not None or detail.response is not None


def test_get_missing_trace_raises_not_found(repo):
    with pytest.raises(TraceNotFoundError):
        repo.get_trace("tr-00000000000000000000000000000000")


def test_api_end_to_end(profile, experiment, first_trace_id):
    app = create_app(Settings(databricks_profile=profile, experiment_name=experiment))
    app.dependency_overrides[get_trace_repository] = lambda: MlflowTraceRepository(
        profile, experiment
    )
    client = TestClient(app)
    listed = client.get("/api/traces", params={"max_results": 1})
    assert listed.status_code == 200
    detail = client.get(f"/api/traces/{first_trace_id}")
    assert detail.status_code == 200
    assert detail.json()["trace_id"] == first_trace_id


def test_list_conversations_ordering(repo):
    page = repo.list_conversations(max_results=5)
    if not page.conversations:
        pytest.skip("experiment has no traces")
    latest = [c.latest_request_time_ms for c in page.conversations]
    assert latest == sorted(latest, reverse=True)
    for conversation in page.conversations:
        times = [t.request_time_ms for t in conversation.traces]
        assert times == sorted(times)
        assert conversation.latest_request_time_ms == times[-1]
        assert {t.session_id for t in conversation.traces} == {conversation.session_id}


def test_list_conversations_returns_complete_conversations(repo):
    # Asking for 1 conversation stops the scan early, so its older turns must come from
    # the per-session fetch; the result should match a larger request.
    one = repo.list_conversations(max_results=1)
    if not one.conversations:
        pytest.skip("experiment has no traces")
    many = repo.list_conversations(max_results=5)
    assert one.conversations[0] == many.conversations[0]
