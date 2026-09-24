"""In-memory stand-in for MlflowClient, covering only the calls the repository makes."""

import json

from mlflow.entities import (
    Experiment,
    Span,
    Trace,
    TraceData,
    TraceInfo,
    TraceLocation,
    TraceState,
)
from mlflow.exceptions import MlflowException
from mlflow.protos.databricks_pb2 import RESOURCE_DOES_NOT_EXIST
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
    )
    return Trace(info=info, data=TraceData(spans=[_root_span(trace_id, inputs, outputs)]))


class FakeMlflowClient:
    def __init__(
        self,
        experiments: dict[str, str],
        traces: list[Trace],
        missing_trace_error: int = RESOURCE_DOES_NOT_EXIST,
    ):
        self._missing_trace_error = missing_trace_error
        self._experiments = experiments  # name -> id
        self._traces = {t.info.trace_id: t for t in traces}
        self.experiment_lookups = 0

    def get_experiment_by_name(self, name: str) -> Experiment | None:
        self.experiment_lookups += 1
        if name not in self._experiments:
            return None
        return Experiment(self._experiments[name], name, "", "active")

    def search_traces(self, *, locations, max_results, page_token, order_by, include_spans):
        matching = sorted(
            (t for t in self._traces.values() if t.info.experiment_id in locations),
            key=lambda t: t.info.request_time,
            reverse=True,
        )
        start = int(page_token or 0)
        end = start + max_results
        token = str(end) if end < len(matching) else None
        return PagedList(matching[start:end], token)

    def get_trace(self, trace_id: str, display: bool = True) -> Trace:
        if trace_id not in self._traces:
            raise MlflowException("not found", error_code=self._missing_trace_error)
        return self._traces[trace_id]
