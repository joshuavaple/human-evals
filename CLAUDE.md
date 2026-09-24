# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

human-evals: a UI for human review and error analysis of LLM outputs. It reads traces (input/output pairs) from a remote **Databricks-hosted MLflow** tracking server, shows them to a reviewer, and will write the review (pass, or free-text issue) back to MLflow as trace feedback. Planned layout: `backend/` (FastAPI) and `frontend/` (React + TypeScript + Vite, not created yet). The frontend must only talk to the backend, never to MLflow directly.

## Backend (`backend/`)

Python 3.12, managed with `uv`. Run commands from `backend/`:

```bash
uv sync                                   # install deps
uv run pytest                             # all tests (integration tests skip without credentials)
uv run pytest tests/unit/test_api.py::test_get_trace   # single test
uv run pytest -m integration --profile <databricks-profile> --experiment <experiment path>
uv run ruff check --fix . && uv run ruff format .
uv run uvicorn --factory app.main:create_app --reload   # dev server on :8000
```

Config is read from `HUMAN_EVALS_*` env vars or `backend/.env` (see `.env.example`): `HUMAN_EVALS_DATABRICKS_PROFILE` and `HUMAN_EVALS_EXPERIMENT_NAME` (a workspace path such as `/Shared/foo`). Integration tests take the same values from `--profile`/`--experiment` or those env vars. Set `MLFLOW_DISABLE_AGENT_HINT=1` to silence MLflow's startup hint.

### Auth

Uses Databricks **U2M OAuth** via a `~/.databrickscfg` profile with `auth_type = databricks-cli` (run `databricks auth login --profile <name>` first). The repository builds `MlflowClient(tracking_uri="databricks://<profile>")`, and MLflow resolves that through the Databricks SDK. It never calls the global `mlflow.set_tracking_uri`.

### Architecture

Layers: `api/routes` (HTTP only) → `repositories/mlflow_repo.py` → MLflow. `mlflow_repo.py` is the **only** module that imports `mlflow`. It converts MLflow `Trace` objects into the Pydantic models in `app/schemas/`, which form the API contract. There is no `services/` layer yet. Add one when review/feedback logic arrives.

- `app/main.py` is an app **factory** (`create_app(settings)`), so importing it doesn't require env vars. Start uvicorn with `--factory`.
- The repository is injected via `app.api.dependencies.get_trace_repository`. Tests replace it with `app.dependency_overrides` and a `FakeMlflowClient` (`tests/unit/fakes.py`) that builds real MLflow `Trace` objects with a root span.
- List endpoints use `search_traces(include_spans=False)` and return only MLflow's truncated `request_preview`/`response_preview`. The detail endpoint fetches the full trace and returns the root span's inputs/outputs, parsed as JSON when possible.
- `get_trace` returns 404 for traces outside the configured experiment.

### MLflow/Databricks gotchas

- A missing trace raises `MlflowException` with `NOT_FOUND` on Databricks but `RESOURCE_DOES_NOT_EXIST` on OSS MLflow. Handle both (`_NOT_FOUND_CODES`).
- MLflow can't pass `databricks-cli` (U2M) credentials to child processes (`get_databricks_env_vars` raises). Keep MLflow calls in-process.
