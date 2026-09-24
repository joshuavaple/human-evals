import pytest
from mlflow.protos.databricks_pb2 import NOT_FOUND, RESOURCE_DOES_NOT_EXIST

from app.repositories.mlflow_repo import (
    ExperimentNotFoundError,
    MlflowTraceRepository,
    TraceNotFoundError,
    databricks_tracking_uri,
)
from tests.unit.fakes import FakeMlflowClient, make_trace

EXPERIMENT = "/Users/me@example.com/agent"


def make_repo(traces=None, experiments=None) -> tuple[MlflowTraceRepository, FakeMlflowClient]:
    client = FakeMlflowClient(experiments or {EXPERIMENT: "1"}, traces or [])
    return MlflowTraceRepository("my-profile", EXPERIMENT, client=client), client


def test_tracking_uri_targets_databricks_profile():
    assert databricks_tracking_uri("my-profile") == "databricks://my-profile"


def test_experiment_id_is_resolved_once_and_cached():
    repo, client = make_repo()
    assert repo.experiment_id == "1"
    assert repo.experiment_id == "1"
    assert client.experiment_lookups == 1


def test_unknown_experiment_raises():
    repo, _ = make_repo(experiments={"/other": "9"})
    with pytest.raises(ExperimentNotFoundError):
        repo.list_traces()


def test_list_traces_returns_newest_first_and_only_from_experiment():
    repo, _ = make_repo(
        traces=[
            make_trace("tr-old", request_time=1),
            make_trace("tr-new", request_time=2),
            make_trace("tr-elsewhere", experiment_id="2"),
        ]
    )
    page = repo.list_traces()
    assert [t.trace_id for t in page.traces] == ["tr-new", "tr-old"]
    assert page.next_page_token is None
    assert page.traces[0].request_preview == '{"question": "question tr-new"}'
    assert page.traces[0].state == "OK"


def test_list_traces_paginates():
    repo, _ = make_repo(traces=[make_trace(f"tr-{i}", request_time=i) for i in range(3)])
    first = repo.list_traces(max_results=2)
    second = repo.list_traces(max_results=2, page_token=first.next_page_token)
    assert [t.trace_id for t in first.traces] == ["tr-2", "tr-1"]
    assert [t.trace_id for t in second.traces] == ["tr-0"]
    assert second.next_page_token is None


def test_get_trace_parses_root_span_io():
    repo, _ = make_repo(traces=[make_trace("tr-1")])
    detail = repo.get_trace("tr-1")
    assert detail.request == {"question": "question tr-1"}
    assert detail.response == {"answer": "answer tr-1"}


def test_get_trace_keeps_non_json_values_as_is():
    repo, _ = make_repo(traces=[make_trace("tr-1", outputs="plain text")])
    assert repo.get_trace("tr-1").response == "plain text"


@pytest.mark.parametrize("error_code", [RESOURCE_DOES_NOT_EXIST, NOT_FOUND])  # OSS, Databricks
def test_get_missing_trace_raises_not_found(error_code):
    client = FakeMlflowClient({EXPERIMENT: "1"}, [], missing_trace_error=error_code)
    repo = MlflowTraceRepository("my-profile", EXPERIMENT, client=client)
    with pytest.raises(TraceNotFoundError):
        repo.get_trace("tr-missing")


def test_get_trace_from_other_experiment_raises_not_found():
    repo, _ = make_repo(traces=[make_trace("tr-foreign", experiment_id="2")])
    with pytest.raises(TraceNotFoundError):
        repo.get_trace("tr-foreign")


def _ids(conversation):
    return [t.trace_id for t in conversation.traces]


def test_list_conversations_groups_by_session_latest_first_turns_ascending():
    repo, _ = make_repo(
        traces=[
            make_trace("a1", request_time=1, session_id="A"),
            make_trace("b1", request_time=2, session_id="B"),
            make_trace("a2", request_time=3, session_id="A"),
            make_trace("b2", request_time=4, session_id="B"),
            make_trace("a3", request_time=5, session_id="A"),
        ]
    )
    page = repo.list_conversations()
    assert [c.session_id for c in page.conversations] == ["A", "B"]
    assert _ids(page.conversations[0]) == ["a1", "a2", "a3"]
    assert _ids(page.conversations[1]) == ["b1", "b2"]
    assert page.conversations[0].latest_request_time_ms == 5
    assert page.conversations[0].traces[0].session_id == "A"
    assert page.has_more is False


def test_traces_without_session_become_single_turn_conversations():
    repo, _ = make_repo(
        traces=[
            make_trace("lone1", request_time=1),
            make_trace("a1", request_time=2, session_id="A"),
            make_trace("lone2", request_time=3),
        ]
    )
    conversations = repo.list_conversations().conversations
    assert [(c.session_id, _ids(c)) for c in conversations] == [
        (None, ["lone2"]),
        ("A", ["a1"]),
        (None, ["lone1"]),
    ]


def test_list_conversations_limits_count_and_completes_older_turns():
    repo, _ = make_repo(
        traces=[
            make_trace("a1", request_time=1, session_id="A"),  # older than the scanned window
            make_trace("b1", request_time=2, session_id="B"),
            make_trace("a2", request_time=3, session_id="A"),
            make_trace("c1", request_time=4, session_id="C"),
        ]
    )
    page = repo.list_conversations(max_results=2)
    assert [c.session_id for c in page.conversations] == ["C", "A"]
    assert _ids(page.conversations[1]) == ["a1", "a2"]
    assert page.has_more is True


def test_list_conversations_scans_across_pages(monkeypatch):
    monkeypatch.setattr("app.repositories.mlflow_repo._PAGE_SIZE", 2)
    repo, client = make_repo(
        traces=[make_trace(f"t{i}", request_time=i, session_id=f"S{i % 3}") for i in range(7)]
    )
    page = repo.list_conversations()
    assert sorted(len(c.traces) for c in page.conversations) == [2, 2, 3]
    assert page.has_more is False
    assert client.search_calls == 4  # all 7 traces in 4 pages; no per-session fetches needed


def test_session_id_with_quote_falls_back_to_scanned_turns():
    repo, _ = make_repo(
        traces=[
            make_trace("q1", request_time=1, session_id="it's"),
            make_trace("q2", request_time=2, session_id="it's"),
            make_trace("x1", request_time=3, session_id="X"),
        ]
    )
    page = repo.list_conversations(max_results=1)  # forces per-session fetches
    assert [c.session_id for c in page.conversations] == ["X"]
    assert page.has_more is True
    assert [c.session_id for c in repo.list_conversations(max_results=5).conversations] == [
        "X",
        "it's",
    ]


def test_list_conversations_on_empty_experiment():
    repo, _ = make_repo()
    page = repo.list_conversations()
    assert page.conversations == []
    assert page.has_more is False
