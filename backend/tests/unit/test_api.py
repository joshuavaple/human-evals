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
    repo = MlflowRepository(
        "p", "/Shared", client=fake, tracing_client=fake, reviewer="me@example.com"
    )
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


def test_save_and_read_review(client):
    response = client.put("/api/experiments/1/traces/a1/review", json={"verdict": "pass"})
    assert response.status_code == 200
    assert response.json()["verdict"] == "pass"
    assert response.json()["reviewer"] == "me@example.com"
    assert client.get("/api/experiments/1/traces/a1").json()["review"]["verdict"] == "pass"
    turns = client.get("/api/experiments/1/conversations").json()["conversations"][0]["traces"]
    assert [t["review"] and t["review"]["verdict"] for t in turns] == ["pass", None]


def test_pass_with_note(client):
    body = {"verdict": "pass", "comment": "Good use of the tool"}
    response = client.put("/api/experiments/1/traces/a1/review", json=body)
    assert response.json()["comment"] == "Good use of the tool"


def test_issue_without_comment_is_422(client):
    response = client.put("/api/experiments/1/traces/a1/review", json={"verdict": "issue"})
    assert response.status_code == 422
    assert "Describe the issue" in response.text


def test_delete_review(client):
    client.put("/api/experiments/1/traces/a1/review", json={"verdict": "issue", "comment": "x"})
    assert client.delete("/api/experiments/1/traces/a1/review").status_code == 204
    assert client.get("/api/experiments/1/traces/a1").json()["review"] is None


def test_review_on_missing_trace_is_404(client):
    response = client.put("/api/experiments/1/traces/nope/review", json={"verdict": "pass"})
    assert response.status_code == 404
