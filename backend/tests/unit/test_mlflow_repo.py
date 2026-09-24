import pytest
from mlflow.protos.databricks_pb2 import NOT_FOUND, RESOURCE_DOES_NOT_EXIST

from app.repositories.mlflow_repo import (
    ExperimentNotFoundError,
    MlflowRepository,
    TraceNotFoundError,
    databricks_tracking_uri,
)
from tests.unit.fakes import FakeMlflowClient, make_trace

FOLDER = "/Shared"
EXP_ID = "1"


def make_repo(
    traces=None, experiments=None, **fake_kwargs
) -> tuple[MlflowRepository, FakeMlflowClient]:
    client = FakeMlflowClient(experiments or {"/Shared/agent": EXP_ID}, traces or [], **fake_kwargs)
    return MlflowRepository("my-profile", FOLDER, client=client), client


def test_tracking_uri_targets_databricks_profile():
    assert databricks_tracking_uri("my-profile") == "databricks://my-profile"


def test_list_experiments_only_direct_children_of_folder_newest_first():
    repo, _ = make_repo(
        experiments={
            "/Shared/old": "1",
            "/Shared/new": "3",
            "/Shared/sub/nested": "4",  # in a subfolder
            "/Shared-other/x": "5",  # different folder with the same prefix
            "/Users/me/mine": "6",
            "/Shared/gone": "7",
        },
        deleted=frozenset({"/Shared/gone"}),
    )
    listing = repo.list_experiments()
    assert listing.folder == "/Shared"
    assert [(e.experiment_id, e.name, e.path) for e in listing.experiments] == [
        ("3", "new", "/Shared/new"),
        ("1", "old", "/Shared/old"),
    ]
    assert listing.experiments[0].last_update_time_ms == 3
    assert listing.experiments[0].location == "/Shared"
    assert listing.experiments[0].created_by == "owner3@example.com"


def test_list_experiments_pages_through_results(monkeypatch):
    monkeypatch.setattr("app.repositories.mlflow_repo._PAGE_SIZE", 2)
    repo, _ = make_repo(experiments={f"/Shared/e{i}": str(i) for i in range(1, 6)})
    assert len(repo.list_experiments().experiments) == 5


def test_folder_trailing_slash_is_ignored():
    client = FakeMlflowClient({"/Shared/agent": "1"}, [])
    repo = MlflowRepository("my-profile", "/Shared/", client=client)
    assert repo.list_experiments().folder == "/Shared"
    assert [e.path for e in repo.list_experiments().experiments] == ["/Shared/agent"]


def test_get_experiment_is_looked_up_once():
    repo, client = make_repo()
    assert repo.get_experiment(EXP_ID).path == "/Shared/agent"
    repo.list_traces(EXP_ID)
    repo.list_conversations(EXP_ID)
    assert client.get_experiment_calls == 1


def test_listed_experiments_need_no_extra_lookup():
    repo, client = make_repo()
    repo.list_experiments()
    repo.list_traces(EXP_ID)
    assert client.get_experiment_calls == 0


@pytest.mark.parametrize(
    "experiment_id",
    [
        "9",  # doesn't exist
        "abc",  # malformed
        "2",  # outside the folder
        "3",  # deleted
    ],
)
def test_experiments_outside_the_browsable_set_are_not_found(experiment_id):
    repo, _ = make_repo(
        experiments={"/Shared/agent": "1", "/Users/me/private": "2", "/Shared/gone": "3"},
        deleted=frozenset({"/Shared/gone"}),
    )
    with pytest.raises(ExperimentNotFoundError):
        repo.get_experiment(experiment_id)
    with pytest.raises(ExperimentNotFoundError):
        repo.list_conversations(experiment_id)


def test_list_traces_returns_newest_first_and_only_from_experiment():
    repo, _ = make_repo(
        traces=[
            make_trace("tr-old", request_time=1),
            make_trace("tr-new", request_time=2),
            make_trace("tr-elsewhere", experiment_id="2"),
        ]
    )
    page = repo.list_traces(EXP_ID)
    assert [t.trace_id for t in page.traces] == ["tr-new", "tr-old"]
    assert page.next_page_token is None
    assert page.traces[0].request_preview == '{"question": "question tr-new"}'
    assert page.traces[0].state == "OK"


def test_list_traces_paginates():
    repo, _ = make_repo(traces=[make_trace(f"tr-{i}", request_time=i) for i in range(3)])
    first = repo.list_traces(EXP_ID, max_results=2)
    second = repo.list_traces(EXP_ID, max_results=2, page_token=first.next_page_token)
    assert [t.trace_id for t in first.traces] == ["tr-2", "tr-1"]
    assert [t.trace_id for t in second.traces] == ["tr-0"]
    assert second.next_page_token is None


def test_get_trace_parses_root_span_io():
    repo, _ = make_repo(traces=[make_trace("tr-1")])
    detail = repo.get_trace(EXP_ID, "tr-1")
    assert detail.request == {"question": "question tr-1"}
    assert detail.response == {"answer": "answer tr-1"}


def test_get_trace_keeps_non_json_values_as_is():
    repo, _ = make_repo(traces=[make_trace("tr-1", outputs="plain text")])
    assert repo.get_trace(EXP_ID, "tr-1").response == "plain text"


@pytest.mark.parametrize("error_code", [RESOURCE_DOES_NOT_EXIST, NOT_FOUND])  # OSS, Databricks
def test_get_missing_trace_raises_not_found(error_code):
    repo, _ = make_repo(missing_trace_error=error_code)
    with pytest.raises(TraceNotFoundError):
        repo.get_trace(EXP_ID, "tr-missing")


def test_get_trace_from_other_experiment_raises_not_found():
    repo, _ = make_repo(traces=[make_trace("tr-foreign", experiment_id="2")])
    with pytest.raises(TraceNotFoundError):
        repo.get_trace(EXP_ID, "tr-foreign")


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
    page = repo.list_conversations(EXP_ID)
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
    conversations = repo.list_conversations(EXP_ID).conversations
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
    page = repo.list_conversations(EXP_ID, max_results=2)
    assert [c.session_id for c in page.conversations] == ["C", "A"]
    assert _ids(page.conversations[1]) == ["a1", "a2"]
    assert page.has_more is True


def test_list_conversations_scans_across_pages(monkeypatch):
    monkeypatch.setattr("app.repositories.mlflow_repo._PAGE_SIZE", 2)
    repo, client = make_repo(
        traces=[make_trace(f"t{i}", request_time=i, session_id=f"S{i % 3}") for i in range(7)]
    )
    page = repo.list_conversations(EXP_ID)
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
    page = repo.list_conversations(EXP_ID, max_results=1)  # forces per-session fetches
    assert [c.session_id for c in page.conversations] == ["X"]
    assert page.has_more is True
    assert [c.session_id for c in repo.list_conversations(EXP_ID, max_results=5).conversations] == [
        "X",
        "it's",
    ]


def test_list_conversations_on_empty_experiment():
    repo, _ = make_repo()
    page = repo.list_conversations(EXP_ID)
    assert page.conversations == []
    assert page.has_more is False
