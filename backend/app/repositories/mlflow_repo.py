"""The only module that talks to MLflow. Everything above it works with app.schemas models."""

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from mlflow import MlflowClient
from mlflow.entities import Experiment, Trace
from mlflow.exceptions import MlflowException
from mlflow.protos.databricks_pb2 import (
    BAD_REQUEST,
    INVALID_PARAMETER_VALUE,
    NOT_FOUND,
    RESOURCE_DOES_NOT_EXIST,
    ErrorCode,
)
from mlflow.tracing.constant import TraceMetadataKey

from app.schemas import (
    Conversation,
    ConversationPage,
    ExperimentList,
    ExperimentSummary,
    TraceDetail,
    TracePage,
    TraceSummary,
)

# OSS MLflow reports a missing trace as RESOURCE_DOES_NOT_EXIST, Databricks as NOT_FOUND.
_NOT_FOUND_CODES = {ErrorCode.Name(RESOURCE_DOES_NOT_EXIST), ErrorCode.Name(NOT_FOUND)}
# A malformed experiment ID is BAD_REQUEST on Databricks, INVALID_PARAMETER_VALUE on OSS.
_BAD_EXPERIMENT_ID_CODES = _NOT_FOUND_CODES | {
    ErrorCode.Name(BAD_REQUEST),
    ErrorCode.Name(INVALID_PARAMETER_VALUE),
}

# Experiment tag Databricks sets to the creator's email.
_OWNER_EMAIL_TAG = "mlflow.ownerEmail"

# Trace metadata key holding the conversation ID ("mlflow.trace.session").
_SESSION_KEY = TraceMetadataKey.TRACE_SESSION
_PAGE_SIZE = 100
_MAX_PARALLEL_FETCHES = 8


class ExperimentNotFoundError(Exception):
    pass


class TraceNotFoundError(Exception):
    pass


def databricks_tracking_uri(profile: str) -> str:
    # MLflow resolves "databricks://<profile>" through the Databricks SDK, which reads the
    # profile from ~/.databrickscfg and supports U2M OAuth (auth_type = databricks-cli).
    return f"databricks://{profile}"


class MlflowRepository:
    """Reads experiments in one workspace folder, and the traces inside them.

    Every trace method takes an experiment ID and first checks that the experiment
    exists and lives in the folder, raising ExperimentNotFoundError otherwise.
    """

    def __init__(self, profile: str, experiment_folder: str, client: MlflowClient | None = None):
        self._client = client or MlflowClient(tracking_uri=databricks_tracking_uri(profile))
        self._folder = experiment_folder.rstrip("/")
        # Experiments already checked to be in the folder, so each request doesn't
        # pay for another lookup. id -> summary
        self._known: dict[str, ExperimentSummary] = {}

    def list_experiments(self) -> ExperimentList:
        """Active experiments directly inside the folder, most recently updated first."""
        prefix = self._folder + "/"
        experiments: list[ExperimentSummary] = []
        page_token = None
        while True:
            page = self._client.search_experiments(
                filter_string=f"name LIKE '{prefix}%'",
                max_results=_PAGE_SIZE,
                order_by=["last_update_time DESC"],
                page_token=page_token,
            )
            experiments.extend(
                _to_experiment(e) for e in page if "/" not in e.name.removeprefix(prefix)
            )
            page_token = page.token
            if not page_token:
                break
        self._known.update((e.experiment_id, e) for e in experiments)
        return ExperimentList(folder=self._folder, experiments=experiments)

    def get_experiment(self, experiment_id: str) -> ExperimentSummary:
        if experiment_id in self._known:
            return self._known[experiment_id]
        try:
            experiment = self._client.get_experiment(experiment_id)
        except MlflowException as e:
            if e.error_code in _BAD_EXPERIMENT_ID_CODES:
                raise ExperimentNotFoundError(experiment_id) from e
            raise
        in_folder = experiment.name.startswith(self._folder + "/")
        if experiment.lifecycle_stage != "active" or not in_folder:
            raise ExperimentNotFoundError(experiment_id)
        self._known[experiment_id] = _to_experiment(experiment)
        return self._known[experiment_id]

    def list_traces(
        self, experiment_id: str, max_results: int = 50, page_token: str | None = None
    ) -> TracePage:
        self.get_experiment(experiment_id)
        traces = self._client.search_traces(
            locations=[experiment_id],
            max_results=max_results,
            page_token=page_token,
            order_by=["timestamp_ms DESC"],
            include_spans=False,
        )
        return TracePage(
            traces=[_to_summary(t) for t in traces],
            next_page_token=traces.token or None,
        )

    def list_conversations(self, experiment_id: str, max_results: int = 20) -> ConversationPage:
        """The `max_results` conversations with the most recent activity, each complete.

        Same approach as `mlflow.search_sessions` (which only works with the global
        tracking URI): scan traces newest first to pick the conversations, then fetch
        each one in full, since its older turns may lie beyond the scanned traces.

        There is no page token: a conversation's turns are spread across trace pages,
        so resuming a scan would return it twice. Callers wanting more conversations
        ask again with a larger `max_results`.
        """
        self.get_experiment(experiment_id)
        # Step 1. Newest first, so the first trace seen of each conversation is its
        # latest turn and `scanned` ends up ordered by most recent activity.
        scanned: dict[str, list[Trace]] = {}
        has_more = False
        exhausted = False
        page_token = None
        while not has_more and not exhausted:
            page = self._search(experiment_id, page_token, order_by=["timestamp_ms DESC"])
            for trace in page:
                key = _session_id(trace) or f"trace:{trace.info.trace_id}"
                if key not in scanned and len(scanned) == max_results:
                    has_more = True
                    break
                scanned.setdefault(key, []).append(trace)
            page_token = page.token
            exhausted = not page_token

        # Step 2. If every trace was scanned, the groups are already complete.
        if exhausted and not has_more:
            groups = list(scanned.values())
        else:
            with ThreadPoolExecutor(max_workers=_MAX_PARALLEL_FETCHES) as pool:
                groups = list(
                    pool.map(
                        lambda turns: self._complete_conversation(experiment_id, turns),
                        scanned.values(),
                    )
                )

        conversations = [_to_conversation(traces) for traces in groups]
        conversations.sort(key=lambda c: c.latest_request_time_ms, reverse=True)
        return ConversationPage(conversations=conversations, has_more=has_more)

    def _complete_conversation(self, experiment_id: str, scanned: list[Trace]) -> list[Trace]:
        session_id = _session_id(scanned[0])
        # No session: a single trace. A quote can't be safely put in an MLflow filter
        # string, so for such IDs we keep the (possibly partial) scanned turns.
        if session_id is None or "'" in session_id:
            return scanned
        traces: list[Trace] = []
        page_token = None
        while True:
            page = self._search(
                experiment_id,
                page_token,
                order_by=["timestamp_ms ASC"],
                filter_string=f"metadata.`{_SESSION_KEY}` = '{session_id}'",
            )
            traces.extend(page)
            page_token = page.token
            if not page_token:
                return traces

    def _search(
        self,
        experiment_id: str,
        page_token: str | None,
        order_by: list[str],
        filter_string: str | None = None,
    ):
        return self._client.search_traces(
            locations=[experiment_id],
            filter_string=filter_string,
            max_results=_PAGE_SIZE,
            page_token=page_token,
            order_by=order_by,
            include_spans=False,
        )

    def get_trace(self, experiment_id: str, trace_id: str) -> TraceDetail:
        self.get_experiment(experiment_id)
        try:
            trace = self._client.get_trace(trace_id, display=False)
        except MlflowException as e:
            if e.error_code in _NOT_FOUND_CODES:
                raise TraceNotFoundError(trace_id) from e
            raise
        # Don't serve traces from other experiments just because the ID was guessed.
        if trace is None or trace.info.experiment_id != experiment_id:
            raise TraceNotFoundError(trace_id)
        return TraceDetail(
            **_to_summary(trace).model_dump(),
            request=_parse_json(trace.data.request),
            response=_parse_json(trace.data.response),
        )


def _to_experiment(experiment: Experiment) -> ExperimentSummary:
    location, name = experiment.name.rsplit("/", 1)
    return ExperimentSummary(
        experiment_id=experiment.experiment_id,
        name=name,
        path=experiment.name,
        location=location,
        created_by=experiment.tags.get(_OWNER_EMAIL_TAG),
        last_update_time_ms=experiment.last_update_time,
    )


def _to_summary(trace: Trace) -> TraceSummary:
    info = trace.info
    return TraceSummary(
        trace_id=info.trace_id,
        session_id=_session_id(trace),
        request_time_ms=info.request_time,
        state=info.state.value if hasattr(info.state, "value") else str(info.state),
        execution_duration_ms=info.execution_duration,
        request_preview=info.request_preview,
        response_preview=info.response_preview,
    )


def _session_id(trace: Trace) -> str | None:
    return trace.info.trace_metadata.get(_SESSION_KEY) or None


def _to_conversation(traces: list[Trace]) -> Conversation:
    summaries = sorted((_to_summary(t) for t in traces), key=lambda t: t.request_time_ms)
    return Conversation(
        session_id=summaries[0].session_id,
        latest_request_time_ms=summaries[-1].request_time_ms,
        traces=summaries,
    )


def _parse_json(value: str | None) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value
