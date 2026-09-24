"""Read-only checks against a live Databricks workspace.

Run with:  uv run pytest -m integration --profile <profile> --experiment <experiment path>
(or set HUMAN_EVALS_DATABRICKS_PROFILE / HUMAN_EVALS_TEST_EXPERIMENT). The experiment
should have traces; the tests browse the folder that contains it.
"""

import pytest
from databricks.sdk import WorkspaceClient
from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.config import Settings
from app.main import create_app
from app.repositories.mlflow_repo import (
    ExperimentNotFoundError,
    MlflowRepository,
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
def experiment_path(request) -> str:
    value = request.config.getoption("--experiment")
    if not value:
        pytest.skip("pass --experiment or set HUMAN_EVALS_TEST_EXPERIMENT")
    return value


@pytest.fixture(scope="module")
def folder(experiment_path) -> str:
    return experiment_path.rsplit("/", 1)[0]


@pytest.fixture(scope="module")
def repo(profile, folder) -> MlflowRepository:
    return MlflowRepository(profile, folder)


@pytest.fixture(scope="module")
def experiment_id(repo, experiment_path) -> str:
    matches = [e for e in repo.list_experiments().experiments if e.path == experiment_path]
    assert matches, f"{experiment_path} not listed in its folder"
    return matches[0].experiment_id


@pytest.fixture(scope="module")
def first_trace_id(repo, experiment_id) -> str:
    page = repo.list_traces(experiment_id, max_results=1)
    if not page.traces:
        pytest.skip("experiment has no traces")
    return page.traces[0].trace_id


def test_profile_authenticates_with_u2m(profile):
    me = WorkspaceClient(profile=profile).current_user.me()
    assert me.user_name


def test_list_experiments(repo, folder):
    listing = repo.list_experiments()
    assert listing.folder == folder
    assert listing.experiments
    for e in listing.experiments:
        assert e.path == f"{folder}/{e.name}"
        assert e.location == folder
        assert e.created_by  # Databricks tags every experiment with its creator's email
    times = [e.last_update_time_ms for e in listing.experiments]
    assert times == sorted(times, reverse=True)


def test_get_experiment(profile, folder, experiment_id, experiment_path):
    fresh = MlflowRepository(profile, folder)  # not primed by list_experiments()
    assert fresh.get_experiment(experiment_id).path == experiment_path


@pytest.mark.parametrize("bad_id", ["999999999999999", "not-a-number"])
def test_unknown_experiment_raises(repo, bad_id):
    with pytest.raises(ExperimentNotFoundError):
        repo.get_experiment(bad_id)


def test_experiment_outside_folder_is_not_found(profile, experiment_id):
    repo = MlflowRepository(profile, "/human-evals-no-such-folder")
    with pytest.raises(ExperimentNotFoundError):
        repo.get_experiment(experiment_id)


def test_list_traces(repo, experiment_id):
    page = repo.list_traces(experiment_id, max_results=5)
    assert len(page.traces) <= 5
    times = [t.request_time_ms for t in page.traces]
    assert times == sorted(times, reverse=True)


def test_list_traces_pagination_has_no_overlap(repo, experiment_id):
    first = repo.list_traces(experiment_id, max_results=1)
    if first.next_page_token is None:
        pytest.skip("experiment has fewer than 2 traces")
    second = repo.list_traces(experiment_id, max_results=1, page_token=first.next_page_token)
    assert second.traces
    assert first.traces[0].trace_id != second.traces[0].trace_id


def test_get_trace_returns_io(repo, experiment_id, first_trace_id):
    detail = repo.get_trace(experiment_id, first_trace_id)
    assert detail.trace_id == first_trace_id
    assert detail.request is not None or detail.response is not None


def test_get_missing_trace_raises_not_found(repo, experiment_id):
    with pytest.raises(TraceNotFoundError):
        repo.get_trace(experiment_id, "tr-00000000000000000000000000000000")


def test_list_conversations_ordering(repo, experiment_id):
    page = repo.list_conversations(experiment_id, max_results=5)
    if not page.conversations:
        pytest.skip("experiment has no traces")
    latest = [c.latest_request_time_ms for c in page.conversations]
    assert latest == sorted(latest, reverse=True)
    for conversation in page.conversations:
        times = [t.request_time_ms for t in conversation.traces]
        assert times == sorted(times)
        assert conversation.latest_request_time_ms == times[-1]
        assert {t.session_id for t in conversation.traces} == {conversation.session_id}


def test_list_conversations_returns_complete_conversations(repo, experiment_id):
    # Asking for 1 conversation stops the scan early, so its older turns must come from
    # the per-session fetch; the result should match a larger request.
    one = repo.list_conversations(experiment_id, max_results=1)
    if not one.conversations:
        pytest.skip("experiment has no traces")
    many = repo.list_conversations(experiment_id, max_results=5)
    assert one.conversations[0] == many.conversations[0]


def test_api_end_to_end(profile, folder, experiment_id, first_trace_id):
    app = create_app(Settings(databricks_profile=profile, experiment_folder=folder))
    app.dependency_overrides[get_repository] = lambda: MlflowRepository(profile, folder)
    client = TestClient(app)
    listed = client.get("/api/experiments").json()
    assert experiment_id in [e["experiment_id"] for e in listed["experiments"]]
    conversations = client.get(f"/api/experiments/{experiment_id}/conversations")
    assert conversations.status_code == 200
    detail = client.get(f"/api/experiments/{experiment_id}/traces/{first_trace_id}")
    assert detail.status_code == 200
    assert detail.json()["trace_id"] == first_trace_id
