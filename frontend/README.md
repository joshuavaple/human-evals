# Frontend

The review UI for human-evals. It shows traces from the MLflow experiment as readable input/output pairs.

Built with **React** (UI components), **TypeScript** (JavaScript with types), **Vite** (dev server and build tool), **Tailwind CSS** (styling), and **TanStack Query** (fetching and caching backend data).

## Quick start

You need **Node.js 20.19+** (`node --version`) and the backend set up (see [`../backend`](../backend) and the root [README](../README.md)).

Use **two terminals**, because the backend and frontend are separate programs.

**Terminal 1: backend**
```bash
cd backend
uv run uvicorn --factory app.main:create_app --reload
```
Wait for `Application startup complete.` The backend listens on http://localhost:8000.

**Terminal 2: frontend**
```bash
cd frontend
npm install        # first time only, and after package.json changes
npm run dev
```
Open **http://localhost:5173** in your browser.

Both servers reload automatically when you save a file. Stop each with `Ctrl+C`.

## How the frontend talks to the backend

```
Browser ──► Vite dev server (:5173) ──/api/*──► FastAPI backend (:8000) ──► Databricks MLflow
```

The browser only ever talks to the Vite dev server. Any request starting with `/api` is forwarded ("proxied") to the backend. This is configured in `vite.config.ts` (`server.proxy`). Because of this:

- The frontend code calls relative URLs like `/api/traces`, with no hostnames.
- There's no CORS setup to worry about.
- If the backend runs on another port, start the frontend with `BACKEND_URL=http://localhost:9000 npm run dev`.

The frontend never talks to MLflow or Databricks directly. All credentials stay in the backend.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server at http://localhost:5173 |
| `npm test` | Runs the tests once |
| `npm run test:watch` | Re-runs tests whenever you save |
| `npx vitest run src/App.test.tsx` | Runs a single test file (add `-t "name"` for one test) |
| `npm run typecheck` | Checks TypeScript types without building |
| `npm run lint` | Checks for common mistakes (oxlint) |
| `npm run build` | Production build into `dist/` |
| `npm run gen:api` | Regenerates `src/api/schema.d.ts` from the backend. **Backend must be running.** |

## Folder structure

```
frontend/
├── index.html                 # The single HTML page; React renders into <div id="root">
├── vite.config.ts             # Dev server, /api proxy, Tailwind, test setup
├── package.json               # Dependencies and the npm scripts above
└── src/
    ├── main.tsx               # Entry point: starts React and TanStack Query
    ├── App.tsx                # Page layout: header, trace list, trace detail
    ├── index.css              # Loads Tailwind
    │
    ├── api/                   # ── Talking to the backend (nothing else does) ──
    │   ├── schema.d.ts        # GENERATED from the backend. Don't edit; run `npm run gen:api`
    │   ├── types.ts           # Short names for generated types (TraceSummary, TraceDetail…)
    │   ├── client.ts          # Typed HTTP client + ApiError
    │   └── traces.ts          # One function per endpoint: fetchTraces, fetchTrace
    │
    ├── features/              # ── One folder per feature of the app ──
    │   ├── traces/
    │   │   ├── hooks/         # Data loading for components (useTraceList, useTrace)
    │   │   ├── components/    # UI for this feature (TraceList, TraceDetail, IOPanel…)
    │   │   └── lib/           # Plain logic, no UI (conversation parsing, formatting)
    │   └── theme/             # Light/dark mode switch (top-right button)
    │
    ├── components/ui/         # Small reusable pieces not tied to a feature (Badge, ErrorMessage)
    └── test/setup.ts          # Test setup (adds matchers like toBeInTheDocument)
```

Tests live next to the file they test, named `*.test.ts(x)`.

### The layers, and which way they depend

```
components  ──use──►  hooks  ──call──►  api/  ──HTTP──►  backend
     │
     └──use──►  lib/  (plain functions, easy to test)
```

- **`api/`** knows URLs and HTTP. It doesn't know about React.
- **`hooks/`** wrap the `api/` functions with TanStack Query, which handles loading states, errors, caching and paging. Components get `{ data, error, isPending }` back.
- **`components/`** only render UI. They get data from hooks and never call `fetch` themselves.
- **`lib/`** holds logic with no UI. `conversation.ts` turns the different agent formats (OpenAI chat, MLflow ResponsesAgent, LangChain…) into a common list of messages. If a format isn't recognised, the UI falls back to raw JSON.

## Common tasks

**The backend API changed (new field or endpoint).** Start the backend, then run `npm run gen:api`. TypeScript will point out (`npm run typecheck`) every place that needs updating. For a new endpoint, add a function in `src/api/`, then a hook in the feature's `hooks/` folder.

**A trace shows raw JSON instead of a conversation.** Its format isn't recognised yet. Add it to `src/features/traces/lib/conversation.ts`, with a test in `conversation.test.ts`.

**Styling for dark mode.** Dark mode works by adding `class="dark"` to the page's `<html>` tag. Every colour class needs a `dark:` partner, which only applies in dark mode. For example, `bg-white dark:bg-slate-900` or `text-slate-500 dark:text-slate-400`. Copy the pairs already used in existing components so the colours stay consistent. To check, click the sun/moon button at the top right.

**Adding a new feature** (e.g. reviewing): create `src/features/<name>/` with the same `hooks/`, `components/` and `lib/` folders.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Could not load traces" with a 500 error | The backend can't reach Databricks: check `backend/.env` and run `databricks auth login --profile <name>` |
| "Could not load traces" with a 502/504, or `ECONNREFUSED` in the terminal | The backend isn't running (terminal 1) |
| `npm run dev` fails with an engine/version error | Node.js is too old. Install Node 20.19 or newer |
| Port 5173 already in use | Another `npm run dev` is still running. Stop it, or Vite picks the next free port (read the URL it prints) |
