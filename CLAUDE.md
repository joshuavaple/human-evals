# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

human-evals: a UI for human review and error analysis of LLM outputs. It reads traces (input/output pairs) from a remote **Databricks-hosted MLflow** tracking server, shows them to a reviewer, and will write the review (pass, or free-text issue) back to MLflow as trace feedback. Layout: `backend/` (FastAPI) and `frontend/` (React + TypeScript + Vite). The frontend only talks to the backend, never to MLflow directly. Running both locally takes two terminals (see README.md).

The user is new to frontend development. When changing `frontend/`, keep the folder conventions below, explain frontend concepts in plain terms, and update `frontend/README.md` when commands or structure change.

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

## Frontend (`frontend/`)

Node 20.19+, npm. Run commands from `frontend/`:

```bash
npm install
npm run dev                  # :5173, proxies /api/* to the backend (BACKEND_URL, default :8000)
npm test                     # vitest, once
npx vitest run src/features/traces/lib/conversation.test.ts -t "LangChain"   # single test
npm run typecheck && npm run lint && npm run build
npm run gen:api              # regenerate src/api/schema.d.ts, needs the backend running on :8000
```

### Architecture

Dependency direction: `components` → `hooks` → `api/` → backend, with `lib/` for pure logic.

- `src/api/schema.d.ts` is **generated** from FastAPI's OpenAPI spec (`openapi-typescript`). Never hand-edit it. After changing backend schemas or routes, run `gen:api` and commit the result. `openapi-typescript` declares a TS 5 peer dependency, so `package.json` has an `overrides` entry to use the project's TS 6.
- `src/api/traces.ts` has one function per endpoint, using the typed `openapi-fetch` client (base URL `''`, relying on the Vite proxy). Only `api/` makes HTTP calls.
- `src/features/<feature>/{hooks,components,lib}`: hooks wrap `api/` with TanStack Query (`useInfiniteQuery` for the paginated list, keyed `['traces']`/`['traces', id]`). Components never fetch directly.
- `features/traces/lib/conversation.ts` normalises agent I/O formats (OpenAI chat and completions, MLflow ResponsesAgent input/output including `function_call` items, LangChain `human`/`ai`/`tool` messages) into `Message[]`. It returns `null` for unknown shapes, and `IOPanel` then shows raw JSON. Add new formats there with a test.
- Component tests mock `@/api/traces` with `vi.mock` rather than stubbing `fetch`, because the jsdom test environment can't resolve the relative URLs the client uses.
- Dark mode is class-based: `@custom-variant dark` in `src/index.css` makes `dark:` classes depend on `.dark` on `<html>`, not the OS setting. `features/theme` toggles the class and saves the choice to localStorage (`theme` key), falling back to `prefers-color-scheme`. An inline script in `index.html` repeats that logic before React loads to avoid a white flash, so keep the two in sync. Every new colour class needs a `dark:` counterpart (e.g. `bg-white dark:bg-slate-900`, `text-slate-500 dark:text-slate-400`, `prose dark:prose-invert`).
- Import alias `@/` → `src/` (set in both `vite.config.ts` and `tsconfig.app.json`). Styling is Tailwind v4 utility classes, plus `@tailwindcss/typography` (`prose`) for markdown message bodies.
