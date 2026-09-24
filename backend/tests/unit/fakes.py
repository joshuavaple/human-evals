"""In-memory stand-in for MlflowClient and TracingClient, covering only the calls the
repository makes."""

import itertools
import json
import re

from mlflow.entities import (
    Assessment,
    Experiment,
    ExperimentTag,
    Span,
    Trace,
    TraceData,
    TraceInfo,
    TraceLocation,
    TraceState,
)
from mlflow.exceptions import MlflowException
from mlflow.protos.databricks_pb2 import BAD_REQUEST, RESOURCE_DOES_NOT_EXIST
from mlflow.store.entities.paged_list import PagedList


def _root_span(trace_id: str, inputs: object, outputs: object) -> Span:
    # Same shape MLflow itself serializes; the root span carries the trace's request/response.
    return Span.from_dict(
        {
            "trace_id": "Rd1lxya+DytDB09njijcSQ==",
            "span_id": "WmkP02o0+9k=",
            "parent_span_id": None,
            "name": "agent",
            "start_time_unix_nano": 1_000_000_000,
            "end_time_unix_nano": 2_000_000_000,
            "events": [],
            "status": {"code": "STATUS_CODE_OK", "message": ""},
            "attributes": {
                "mlflow.traceRequestId": json.dumps(trace_id),
                "mlflow.spanType": json.dumps("AGENT"),
                "mlflow.spanInputs": json.dumps(inputs),
                "mlflow.spanOutputs": json.dumps(outputs),
            },
            "links": [],
        }
    )


def make_trace(
    trace_id: str,
    experiment_id: str = "1",
    request_time: int = 1_000,
    inputs: object = None,
    outputs: object = None,
    session_id: str | None = None,
) -> Trace:
    inputs = inputs if inputs is not None else {"question": f"question {trace_id}"}
    outputs = outputs if outputs is not None else {"answer": f"answer {trace_id}"}
    info = TraceInfo(
        trace_id=trace_id,
        trace_location=TraceLocation.from_experiment_id(experiment_id),
        request_time=request_time,
        state=TraceState.OK,
        request_preview=json.dumps(inputs),
        response_preview=json.dumps(outputs),
        execution_duration=42,
        trace_metadata={"mlflow.trace.session": session_id} if session_id else {},
    )
    return Trace(info=info, data=TraceData(spans=[_root_span(trace_id, inputs, outputs)]))


class FakeMlflowClient:
    def __init__(
        self,
        experiments: dict[str, str],
        traces: list[Trace],
        missing_trace_error: int = RESOURCE_DOES_NOT_EXIST,
        deleted: frozenset[str] = frozenset(),
    ):
        """`experiments` maps workspace path -> numeric ID. An experiment's last update
        time is its ID, so higher IDs count as more recently updated, and its creator
        is "owner<ID>@example.com". `deleted` holds paths of deleted experiments."""
        self._missing_trace_error = missing_trace_error
        self._experiments = {
            eid: Experiment(
                eid,
                name,
                "",
                "deleted" if name in deleted else "active",
                tags=[ExperimentTag("mlflow.ownerEmail", f"owner{eid}@example.com")],
                last_update_time=int(eid),
            )
            for name, eid in experiments.items()
        }
        self._traces = {t.info.trace_id: t for t in traces}
        self.get_experiment_calls = 0
        self.search_calls = 0
        self.fail_deletes = False  # simulate a delete_assessment failure
        self._clock = itertools.count(1)

    def search_experiments(self, *, filter_string, max_results, order_by, page_token):
        # Only the folder filter the repository uses is supported. Like Databricks'
        # default view, deleted experiments are left out.
        match = re.fullmatch(r"name LIKE '(.*)%'", filter_string)
        assert match, f"unsupported filter: {filter_string}"
        assert order_by == ["last_update_time DESC"]
        matching = sorted(
            (
                e
                for e in self._experiments.values()
                if e.name.startswith(match.group(1)) and e.lifecycle_stage == "active"
            ),
            key=lambda e: e.last_update_time,
            reverse=True,
        )
        return _page(matching, max_results, page_token)

    def get_experiment(self, experiment_id: str) -> Experiment:
        self.get_experiment_calls += 1
        if not experiment_id.isdigit():
            raise MlflowException("bad id", error_code=BAD_REQUEST)
        if experiment_id not in self._experiments:
            raise MlflowException("not found", error_code=RESOURCE_DOES_NOT_EXIST)
        return self._experiments[experiment_id]

    def search_traces(
        self, *, locations, max_results, page_token, order_by, include_spans, filter_string=None
    ):
        self.search_calls += 1
        matching = [t for t in self._traces.values() if t.info.experiment_id in locations]
        if filter_string is not None:
            # Only the session filter the repository uses is supported.
            match = re.fullmatch(r"metadata\.`mlflow\.trace\.session` = '(.*)'", filter_string)
            assert match, f"unsupported filter: {filter_string}"
            session = match.group(1)
            matching = [
                t for t in matching if t.info.trace_metadata.get("mlflow.trace.session") == session
            ]
        matching.sort(key=lambda t: t.info.request_time, reverse=order_by[0].endswith("DESC"))
        return _page(matching, max_results, page_token)

    def log_assessment(self, trace_id: str, assessment: Assessment) -> Assessment:
        now = next(self._clock)
        assessment.assessment_id = f"a-{now}"
        assessment.trace_id = trace_id
        assessment.create_time_ms = assessment.last_update_time_ms = now
        self._traces[trace_id].info.assessments.append(assessment)
        return assessment

    def delete_assessment(self, trace_id: str, assessment_id: str) -> None:
        if self.fail_deletes:
            raise MlflowException("delete failed")
        info = self._traces[trace_id].info
        info.assessments = [a for a in info.assessments if a.assessment_id != assessment_id]

    def get_trace(self, trace_id: str, display: bool = True) -> Trace:
        if trace_id not in self._traces:
            raise MlflowException("not found", error_code=self._missing_trace_error)
        return self._traces[trace_id]


def _page(items: list, max_results: int, page_token: str | None) -> PagedList:
    start = int(page_token or 0)
    end = start + max_results
    return PagedList(items[start:end], str(end) if end < len(items) else None)
