import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.config import Settings
from app.main import create_app
from app.repositories.mlflow_repo import MlflowRepository
from tests.unit.fakes import FakeMlflowClient, make_trace


def make_client(traces) -> TestClient:
    app = create_app(Settings(databricks_profile="p"))
    fake = FakeMlflowClient({"/Shared/agent": "1", "/Users/me/private": "2"}, traces)
    repo = MlflowRepository("p", "/Shared", client=fake)
    app.dependency_overrides[get_repository] = lambda: repo
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    return make_client(
        [
            make_trace("a1", request_time=1, session_id="A"),
            make_trace("a2", request_time=2, session_id="A"),
        ]
    )


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_experiments(client):
    body = client.get("/api/experiments").json()
    assert body["folder"] == "/Shared"
    assert [e["path"] for e in body["experiments"]] == ["/Shared/agent"]


def test_get_experiment(client):
    assert client.get("/api/experiments/1").json()["name"] == "agent"


@pytest.mark.parametrize("path", ["/api/experiments/2", "/api/experiments/9/conversations"])
def test_experiment_outside_folder_or_missing_is_404(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert "Experiment not found" in response.json()["detail"]


def test_list_conversations(client):
    body = client.get("/api/experiments/1/conversations").json()
    assert body["has_more"] is False
    assert body["conversations"][0]["session_id"] == "A"
    assert [t["trace_id"] for t in body["conversations"][0]["traces"]] == ["a1", "a2"]


def test_list_traces(client):
    body = client.get("/api/experiments/1/traces").json()
    assert [t["trace_id"] for t in body["traces"]] == ["a2", "a1"]
    assert body["next_page_token"] is None


def test_list_traces_rejects_bad_max_results(client):
    assert client.get("/api/experiments/1/traces", params={"max_results": 0}).status_code == 422


def test_get_trace(client):
    body = client.get("/api/experiments/1/traces/a1").json()
    assert body["request"] == {"question": "question a1"}
    assert body["response"] == {"answer": "answer a1"}


def test_get_missing_trace_is_404(client):
    response = client.get("/api/experiments/1/traces/tr-missing")
    assert response.status_code == 404
    assert "Trace not found" in response.json()["detail"]
