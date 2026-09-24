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
uv run pytest -m integration --profile <databricks-profile> --experiment /Shared/<experiment with traces>
# review (write) tests are opt-in: they create and delete a throwaway trace in the scratch experiment
uv run pytest -m integration --profile <profile> --scratch-experiment /Users/<you>/human-evals-scratch
uv run ruff check --fix . && uv run ruff format .
uv run uvicorn --factory app.main:create_app --reload   # dev server on :8000
```

Config is read from `HUMAN_EVALS_*` env vars or `backend/.env` (see `.env.example`): `HUMAN_EVALS_DATABRICKS_PROFILE` (required) and `HUMAN_EVALS_EXPERIMENT_FOLDER` (default `/Shared`, the workspace folder whose experiments the UI can browse). There is no configured experiment: the frontend picks one, and its ID is in every trace URL. Integration tests take `--profile` and `--experiment` (a path of an experiment with traces; they browse its parent folder), falling back to `HUMAN_EVALS_DATABRICKS_PROFILE` / `HUMAN_EVALS_TEST_EXPERIMENT`. Write tests (`tests/integration/test_databricks_reviews.py`) are skipped unless `--scratch-experiment` / `HUMAN_EVALS_TEST_SCRATCH_EXPERIMENT` is set. Never point them at a real experiment. Set `MLFLOW_DISABLE_AGENT_HINT=1` to silence MLflow's startup hint.

### Auth

Uses Databricks **U2M OAuth** via a `~/.databrickscfg` profile with `auth_type = databricks-cli` (run `databricks auth login --profile <name>` first). The repository builds `MlflowClient(tracking_uri="databricks://<profile>")`, and MLflow resolves that through the Databricks SDK. It never calls the global `mlflow.set_tracking_uri`.

### Architecture

Layers: `api/routes` (HTTP only) → `repositories/mlflow_repo.py` → MLflow. `mlflow_repo.py` is the **only** module that imports `mlflow`. It converts MLflow `Trace` objects into the Pydantic models in `app/schemas/`, which form the API contract. There's deliberately no `services/` layer: the review logic is all about how feedback is stored in MLflow, so it lives in the repository. Add one if logic appears that isn't about MLflow storage.

- `app/main.py` is an app **factory** (`create_app(settings)`), so importing it doesn't require env vars. Start uvicorn with `--factory`.
- The repository (`MlflowRepository`) is injected via `app.api.dependencies.Repo` / `get_repository`. Tests replace it with `app.dependency_overrides` and a `FakeMlflowClient` (`tests/unit/fakes.py`) that builds real MLflow `Trace` objects with a root span.
- List endpoints use `search_traces(include_spans=False)` and return only MLflow's truncated `request_preview`/`response_preview`. The detail endpoint fetches the full trace and returns the root span's inputs/outputs, parsed as JSON when possible.
- Routes: `GET /api/experiments`, `GET /api/experiments/{id}`, and everything trace-related under `/api/experiments/{id}/…` (`conversations`, `traces`, `traces/{trace_id}`). Every repository method that takes an `experiment_id` first calls `get_experiment`, which only accepts active experiments directly inside the folder. IDs are cached in `_known` (and `list_experiments` fills it), so it costs one lookup per experiment per process. `ExperimentNotFoundError` and `TraceNotFoundError` become 404s through exception handlers in `main.py`. Routes don't catch them.
- `list_experiments` uses `search_experiments(filter_string="name LIKE '<folder>/%'")` and drops names containing a further `/` (subfolders). It takes a few seconds on Databricks.
- `get_trace` returns 404 for traces outside the requested experiment.
- **Reviews** (`PUT`/`DELETE /api/experiments/{id}/traces/{trace_id}/review`) are MLflow feedback named `human_review` (`REVIEW_NAME`) from a `HUMAN` source whose `source_id` is the reviewer's email. `value` is `True` for pass and `False` for issue; the issue text is the `rationale`. `ReviewInput` requires a comment for an issue. For a pass it's an optional note (blank → `None`), so "pass with note" is `value=True` plus a rationale and pass-rate metrics are unaffected. The reviewer is the logged-in Databricks user (`MlflowRepository.reviewer`, from `WorkspaceClient(profile).current_user.me()`, cached; tests inject `reviewer=`). Each `TraceSummary` carries `review` = that reviewer's newest review, read from `trace.info.assessments`. `search_traces(include_spans=False)` includes assessments on Databricks, so lists need no extra calls.
- Writing uses `mlflow.tracing.client.TracingClient(tracking_uri=…)`: `MlflowClient` has no assessment methods, and `mlflow.log_feedback` only uses the global URI. Replacing a verdict is **log the new one, then delete the reviewer's old ones**. Databricks' `update_assessment` rejects changing the name and can't clear the rationale, so it isn't used. Logging first means a failed delete leaves a duplicate, and reads pick the newest; nothing is lost. `delete_assessment` on a missing ID doesn't raise.
- **Conversations** are MLflow sessions: traces sharing the `mlflow.trace.session` metadata key. `list_conversations` does the same two steps as `mlflow.search_sessions`, which can't be used because it only works with the global tracking URI. Step 1 scans traces newest first to pick `max_results` conversations (so they're ordered by latest activity). Step 2 fetches each one in full with a `metadata.\`mlflow.trace.session\` = '<id>'` filter, in a thread pool, and is skipped when the scan covered every trace. Turns are sorted oldest first. Traces without a session become single-turn conversations (`session_id = None`). There's no page token (a conversation's turns span trace pages); callers re-request with a larger `max_results`, and `has_more` says whether that would return more.

### MLflow/Databricks gotchas

- A missing trace raises `MlflowException` with `NOT_FOUND` on Databricks but `RESOURCE_DOES_NOT_EXIST` on OSS MLflow. Handle both (`_NOT_FOUND_CODES`). `get_experiment` with a malformed ID raises `BAD_REQUEST` on Databricks (`INVALID_PARAMETER_VALUE` on OSS), also treated as not found.
- MLflow can't pass `databricks-cli` (U2M) credentials to child processes (`get_databricks_env_vars` raises). Keep MLflow calls in-process.

## Frontend (`frontend/`)

Node 20.19+, npm. Run commands from `frontend/`:

```bash
npm install
npm run dev                  # :5173, proxies /api/* to the backend (BACKEND_URL, default :8000)
npm test                     # vitest, once
npx vitest run src/features/traces/lib/messages.test.ts -t "LangChain"   # single test
npm run typecheck && npm run lint && npm run build
npm run gen:api              # regenerate src/api/schema.d.ts, needs the backend running on :8000
```

### Architecture

Dependency direction: `components` → `hooks` → `api/` → backend, with `lib/` for pure logic.

- `src/api/schema.d.ts` is **generated** from FastAPI's OpenAPI spec (`openapi-typescript`). Never hand-edit it. After changing backend schemas or routes, run `gen:api` and commit the result. `openapi-typescript` declares a TS 5 peer dependency, so `package.json` has an `overrides` entry to use the project's TS 6.
- `src/api/experiments.ts` and `src/api/traces.ts` have one function per endpoint, using the typed `openapi-fetch` client (base URL `''`, relying on the Vite proxy). Only `api/` makes HTTP calls.
- `src/features/<feature>/{hooks,components,lib}`: hooks wrap `api/` with TanStack Query (`useExperimentList` keyed `['experiments']` with a 5-minute `staleTime` because listing is slow; `useConversationList` re-queries with a growing limit using `keepPreviousData`, keyed `['conversations', experimentId, limit]`; `useTrace` keyed `['traces', experimentId, id]`). Components never fetch directly.
- `features/traces/lib/messages.ts` normalises agent I/O formats (OpenAI chat and completions, MLflow ResponsesAgent input/output including `function_call` items, LangChain `human`/`ai`/`tool` messages) into `Message[]`, which `MessageList` renders. "Conversation" in this codebase means an MLflow session (group of traces), not the messages inside one trace. It returns `null` for unknown shapes, and `IOPanel` then shows raw JSON. Add new formats there with a test.
- Routing uses React Router (declarative mode): `BrowserRouter` in `main.tsx`, `<Routes>` in `App.tsx`. The experiment table (`features/experiments/components/ExperimentTable`) sorts on the client with the pure functions in `lib/sortExperiments.ts` (empty values last, ties by name, `Intl.Collator` numeric/case-insensitive). The sort lives in the URL query (`?sort=<key>&dir=asc|desc`) through `useExperimentSort`, using `replace` so it adds no history entries. Rows link with router state `{ listSearch }` so the experiment page's back link returns to the same sort. `created_by` comes from the `mlflow.ownerEmail` experiment tag, and `location` is the parent folder. `src/pages/` holds one component per route (`/` → `ExperimentsPage`, `/experiments/:experimentId` → `ExperimentPage`, anything else redirects to `/`). Pages compose feature components and own page layout. `ExperimentPage` renders its view with `key={experimentId}` so the selected trace and expanded conversations reset when switching experiments. The selected trace isn't in the URL.
- `features/review`: `ReviewBar` sits under `TraceDetail` in `ExperimentPage` (fixed; the I/O cards scroll). `useReviewFlow` holds per-trace drafts `{ verdict, text }`: one text box serves issues (required text) and pass notes (optional; opened by the lightbulb half of the split Pass button or `N`). Switching turns keeps typed text. Plain `pass()` on an already-passed turn doesn't save (that would erase its note); it only moves on. It also covers saving, auto-advance (`nextUnreviewedTurn` in `lib/turns.ts`, toggle stored in localStorage `autoAdvance`) and the "Saved as … · Undo" notice (undo puts back the previous review, or deletes). `useReviewMutations` updates the cached `['traces', …]` and all `['conversations', experimentId, …]` queries in place with `setQueryData`/`setQueriesData` rather than refetching, so sidebar markers and next-turn logic update instantly. `useKeyboardShortcuts` (J/K/P/N/I) ignores keys while typing in inputs and calls `preventDefault` so "I"/"N" aren't typed into the box they open. The lightbulb is an SVG (`components/ui/LightbulbIcon`), because 💡 is a colour emoji that ignores text colour. `ExperimentPage` owns `useConversationList` and passes it to `ConversationList` (both the sidebar and turn navigation need it; two hook instances would each keep their own "Load more" limit). `ConversationList` opens the selected turn's conversation by adjusting state during render, not in an effect.
- Component tests mock `@/api/experiments`, `@/api/traces` and `@/api/reviews` with `vi.mock` rather than stubbing `fetch`, because the jsdom test environment can't resolve the relative URLs the client uses. Vitest globals are off, so `src/test/setup.ts` registers Testing Library's `cleanup` explicitly and also runs `vi.clearAllMocks()` after each test. `src/test/renderApp.tsx` renders the whole app in a `MemoryRouter` at a given path. In the sidebar, conversation headers repeat their first question, so tests pick turn buttons by the `aria-current` attribute.
- Dark mode is class-based: `@custom-variant dark` in `src/index.css` makes `dark:` classes depend on `.dark` on `<html>`, not the OS setting. `features/theme` toggles the class and saves the choice to localStorage (`theme` key), falling back to `prefers-color-scheme`. An inline script in `index.html` repeats that logic before React loads to avoid a white flash, so keep the two in sync. Every new colour class needs a `dark:` counterpart (e.g. `bg-white dark:bg-slate-900`, `text-slate-500 dark:text-slate-400`, `prose dark:prose-invert`).
- Import alias `@/` → `src/` (set in both `vite.config.ts` and `tsconfig.app.json`). Styling is Tailwind v4 utility classes, plus `@tailwindcss/typography` (`prose`) for markdown message bodies.
