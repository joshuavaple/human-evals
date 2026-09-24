"""Review (write) checks against a live Databricks workspace.

These write to MLflow, so they only run when given a scratch experiment:
    uv run pytest -m integration --profile <profile> \\
        --scratch-experiment /Users/<you>/human-evals-scratch
Each run logs one throwaway trace there and deletes it afterwards.
"""

import time

import mlflow
import pytest
from mlflow import MlflowClient

from app.repositories.mlflow_repo import REVIEW_NAME, MlflowRepository, databricks_tracking_uri
from app.schemas import ReviewInput

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def scratch(request) -> str:
    value = request.config.getoption("--scratch-experiment")
    if not value:
        pytest.skip("pass --scratch-experiment to run review (write) tests")
    return value


@pytest.fixture(scope="module")
def profile(request) -> str:
    value = request.config.getoption("--profile")
    if not value:
        pytest.skip("pass --profile or set HUMAN_EVALS_DATABRICKS_PROFILE")
    return value


@pytest.fixture(scope="module")
def experiment_id(profile, scratch) -> str:
    client = MlflowClient(tracking_uri=databricks_tracking_uri(profile))
    existing = client.get_experiment_by_name(scratch)
    return existing.experiment_id if existing else client.create_experiment(scratch)


@pytest.fixture(scope="module")
def trace_id(profile, experiment_id):
    # Logging a trace goes through MLflow's global tracking URI, so set it just for this.
    previous = mlflow.get_tracking_uri()
    mlflow.set_tracking_uri(databricks_tracking_uri(profile))
    try:

        @mlflow.trace(name="human-evals-integration-test")
        def agent(question: str) -> dict:
            return {"answer": "42"}

        with mlflow.start_run(experiment_id=experiment_id):
            agent("What is the answer?")
        tid = mlflow.get_last_active_trace_id()
        mlflow.flush_trace_async_logging()
    finally:
        mlflow.set_tracking_uri(previous)

    client = MlflowClient(tracking_uri=databricks_tracking_uri(profile))
    for _ in range(30):  # wait until the trace is readable
        try:
            client.get_trace(tid, display=False)
            break
        except Exception:
            time.sleep(1)
    yield tid
    client.delete_traces(experiment_id, trace_ids=[tid])


@pytest.fixture(scope="module")
def repo(profile, scratch) -> MlflowRepository:
    return MlflowRepository(profile, scratch.rsplit("/", 1)[0])


def test_reviewer_is_the_logged_in_user(repo):
    assert "@" in repo.reviewer


def test_save_replace_and_delete_review(repo, experiment_id, trace_id):
    assert repo.get_trace(experiment_id, trace_id).review is None

    issue = repo.save_review(
        experiment_id, trace_id, ReviewInput(verdict="issue", comment="Made up the answer")
    )
    assert (issue.verdict, issue.comment, issue.reviewer) == (
        "issue",
        "Made up the answer",
        repo.reviewer,
    )
    assert repo.get_trace(experiment_id, trace_id).review == issue

    noted = repo.save_review(
        experiment_id, trace_id, ReviewInput(verdict="pass", comment="Clear answer")
    )
    assert repo.get_trace(experiment_id, trace_id).review == noted
    assert noted.comment == "Clear answer"

    passed = repo.save_review(experiment_id, trace_id, ReviewInput(verdict="pass"))
    detail = repo.get_trace(experiment_id, trace_id)
    assert detail.review == passed
    assert detail.review.comment is None  # the earlier note is gone

    # Replacing leaves exactly one review from this reviewer in MLflow.
    client = MlflowClient(tracking_uri=databricks_tracking_uri(repo._profile))
    own = [
        a
        for a in client.get_trace(trace_id, display=False).info.assessments
        if a.name == REVIEW_NAME and a.source.source_id == repo.reviewer
    ]
    assert [(a.value, a.source.source_type) for a in own] == [(True, "HUMAN")]

    # The review also comes back in the trace list, which skips spans.
    listed = repo.list_traces(experiment_id, max_results=50).traces
    assert next(t for t in listed if t.trace_id == trace_id).review == passed

    repo.delete_review(experiment_id, trace_id)
    assert repo.get_trace(experiment_id, trace_id).review is None
