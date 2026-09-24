import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_trace_repository
from app.config import Settings
from app.main import create_app
from app.repositories.mlflow_repo import MlflowTraceRepository
from tests.unit.fakes import FakeMlflowClient, make_trace

EXPERIMENT = "/Users/me@example.com/agent"


def make_client(experiments: dict[str, str], traces) -> TestClient:
    app = create_app(Settings(databricks_profile="p", experiment_name=EXPERIMENT))
    repo = MlflowTraceRepository("p", EXPERIMENT, client=FakeMlflowClient(experiments, traces))
    app.dependency_overrides[get_trace_repository] = lambda: repo
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    return make_client({EXPERIMENT: "1"}, [make_trace("tr-1", request_time=1)])


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_traces(client):
    body = client.get("/api/traces").json()
    assert [t["trace_id"] for t in body["traces"]] == ["tr-1"]
    assert body["next_page_token"] is None


def test_list_traces_rejects_bad_max_results(client):
    assert client.get("/api/traces", params={"max_results": 0}).status_code == 422


def test_get_trace(client):
    body = client.get("/api/traces/tr-1").json()
    assert body["request"] == {"question": "question tr-1"}
    assert body["response"] == {"answer": "answer tr-1"}


def test_get_missing_trace_is_404(client):
    assert client.get("/api/traces/tr-missing").status_code == 404


def test_misconfigured_experiment_is_500():
    client = make_client({}, [])
    response = client.get("/api/traces")
    assert response.status_code == 500
    assert EXPERIMENT in response.json()["detail"]


def test_list_conversations():
    client = make_client(
        {EXPERIMENT: "1"},
        [
            make_trace("a1", request_time=1, session_id="A"),
            make_trace("a2", request_time=2, session_id="A"),
        ],
    )
    body = client.get("/api/conversations").json()
    assert body["has_more"] is False
    assert body["conversations"][0]["session_id"] == "A"
    assert [t["trace_id"] for t in body["conversations"][0]["traces"]] == ["a1", "a2"]
