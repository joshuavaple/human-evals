"""The only module that talks to MLflow. Everything above it works with app.schemas models."""

import json
from typing import Any

from mlflow import MlflowClient
from mlflow.entities import Trace
from mlflow.exceptions import MlflowException
from mlflow.protos.databricks_pb2 import NOT_FOUND, RESOURCE_DOES_NOT_EXIST, ErrorCode

from app.schemas import TraceDetail, TracePage, TraceSummary

# OSS MLflow reports a missing trace as RESOURCE_DOES_NOT_EXIST, Databricks as NOT_FOUND.
_NOT_FOUND_CODES = {ErrorCode.Name(RESOURCE_DOES_NOT_EXIST), ErrorCode.Name(NOT_FOUND)}


class ExperimentNotFoundError(Exception):
    pass


class TraceNotFoundError(Exception):
    pass


def databricks_tracking_uri(profile: str) -> str:
    # MLflow resolves "databricks://<profile>" through the Databricks SDK, which reads the
    # profile from ~/.databrickscfg and supports U2M OAuth (auth_type = databricks-cli).
    return f"databricks://{profile}"


class MlflowTraceRepository:
    def __init__(self, profile: str, experiment_name: str, client: MlflowClient | None = None):
        self._client = client or MlflowClient(tracking_uri=databricks_tracking_uri(profile))
        self._experiment_name = experiment_name
        self._experiment_id: str | None = None

    @property
    def experiment_id(self) -> str:
        if self._experiment_id is None:
            experiment = self._client.get_experiment_by_name(self._experiment_name)
            if experiment is None:
                raise ExperimentNotFoundError(f"Experiment not found: {self._experiment_name}")
            self._experiment_id = experiment.experiment_id
        return self._experiment_id

    def list_traces(self, max_results: int = 50, page_token: str | None = None) -> TracePage:
        traces = self._client.search_traces(
            experiment_ids=[self.experiment_id],
            max_results=max_results,
            page_token=page_token,
            order_by=["timestamp_ms DESC"],
            include_spans=False,
        )
        return TracePage(
            traces=[_to_summary(t) for t in traces],
            next_page_token=traces.token or None,
        )

    def get_trace(self, trace_id: str) -> TraceDetail:
        try:
            trace = self._client.get_trace(trace_id, display=False)
        except MlflowException as e:
            if e.error_code in _NOT_FOUND_CODES:
                raise TraceNotFoundError(trace_id) from e
            raise
        # Don't serve traces from other experiments just because the ID was guessed.
        if trace is None or trace.info.experiment_id != self.experiment_id:
            raise TraceNotFoundError(trace_id)
        return TraceDetail(
            **_to_summary(trace).model_dump(),
            request=_parse_json(trace.data.request),
            response=_parse_json(trace.data.response),
        )


def _to_summary(trace: Trace) -> TraceSummary:
    info = trace.info
    return TraceSummary(
        trace_id=info.trace_id,
        request_time_ms=info.request_time,
        state=info.state.value if hasattr(info.state, "value") else str(info.state),
        execution_duration_ms=info.execution_duration,
        request_preview=info.request_preview,
        response_preview=info.response_preview,
    )


def _parse_json(value: str | None) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value
