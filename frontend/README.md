# Frontend

The review UI for human-evals. You pick an MLflow experiment, then read its traces as conversations of input/output pairs.

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

## Pages

The app has two pages. Each has its own URL, so the browser's back button, reloading and bookmarks all work:

| URL | Page | What you see |
|---|---|---|
| `/` | Experiments | A table of the experiments in the backend's folder (`/Shared` by default), with the columns of the Databricks Experiments tab: Name, Created by, Last modified, Location. Click a column header to sort by it (click again to flip), and click a row to open it. |
| `/experiments/<id>` | Experiment | That experiment's conversations on the left, the selected trace on the right. "← All experiments" goes back. |

The table's sort is part of the URL (e.g. `/?sort=name&dir=asc`), so it's kept when you open an experiment and come back. Any other URL sends you to `/`. The folder is a backend setting (`HUMAN_EVALS_EXPERIMENT_FOLDER`, see `backend/.env.example`).

Switching between URLs is handled by **React Router**. It swaps the page component without reloading the browser tab. The list of URLs and their pages is in `src/App.tsx`.

## How traces are organised

The left-hand list groups traces into **conversations**. A conversation is all the traces that share an MLflow conversation ID (`mlflow.trace.session`), so one conversation is one chat with the agent.

- **Conversations:** the one with the most recent activity is on top. The newest opens automatically, and you click any other to expand it.
- **Turns:** inside a conversation, the traces are the turns, oldest first, so turn 1 is on top.
- **No conversation ID:** a trace logged without one shows up as its own one-turn conversation.
- **Load more:** fetches 20 more conversations.

The backend does the grouping (`GET /api/experiments/<id>/conversations`). The frontend just displays what it gets.

## Reviewing a turn

Pick a turn in the sidebar (or press **J**). Its input and output appear side by side, with the **review bar** fixed underneath:

- **✓ Pass** (key **P**): the output is acceptable. One click, saved immediately. On a turn that's already passed, P just moves on (it won't wipe out a note).
- **Pass with note**: the lightbulb on the right of the Pass button (key **N**). Opens a text box for what's good about the output. The note is optional; saving it empty is a plain pass.
- **⚑ Issue** (key **I**): opens the same text box: describe what's wrong, then **Save issue** (**Ctrl/⌘+Enter**) or **Cancel** (**Esc**). An issue can't be saved empty.
- After saving, the app jumps to the **next unreviewed turn**. Switch this off with the checkbox in the bar; the choice is remembered.
- A "Saved as … · Undo" message appears for a few seconds. **Undo** puts back what the turn had before and takes you back to it.
- **J / K** move to the next or previous turn. Shortcuts are ignored while you're typing.
- Half-written issue text is kept per turn, so clicking another turn doesn't lose it.

The sidebar shows progress: each reviewed turn gets a coloured number and a ✓ (with a small lightbulb if the pass has a note) or ⚑; hover it to read the note or issue, and each conversation shows "2/5 reviewed" (plus ⚑ and a count if any turn has an issue). Opening a reviewed turn shows your verdict in the bar, and you can change it at any time.

Reviews are saved in MLflow as feedback on the trace, under your Databricks login (the backend decides who you are). Each reviewer has at most one verdict per trace: a new one replaces your old one.

## How the frontend talks to the backend

```
Browser ──► Vite dev server (:5173) ──/api/*──► FastAPI backend (:8000) ──► Databricks MLflow
```

The browser only ever talks to the Vite dev server. Any request starting with `/api` is forwarded ("proxied") to the backend. This is configured in `vite.config.ts` (`server.proxy`). Because of this:

- The frontend code calls relative URLs like `/api/experiments`, with no hostnames.
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
    ├── main.tsx               # Entry point: starts React, TanStack Query and the router
    ├── App.tsx                # Header shown on every page + which page each URL shows
    ├── index.css              # Loads Tailwind
    │
    ├── api/                   # ── Talking to the backend (nothing else does) ──
    │   ├── schema.d.ts        # GENERATED from the backend. Don't edit; run `npm run gen:api`
    │   ├── types.ts           # Short names for generated types (TraceSummary, TraceDetail…)
    │   ├── client.ts          # Typed HTTP client + ApiError
    │   ├── experiments.ts     # One function per endpoint: fetchExperiments, fetchExperiment
    │   └── traces.ts          # One function per endpoint: fetchConversations, fetchTrace
    │
    ├── pages/                 # ── One component per URL; puts feature pieces on the page ──
    │   ├── ExperimentsPage.tsx   # "/"
    │   └── ExperimentPage.tsx    # "/experiments/<id>"
    │
    ├── features/              # ── One folder per feature of the app ──
    │   ├── experiments/       # Experiment table (ExperimentTable; lib/sortExperiments.ts has the sort rules)
    │   ├── traces/
    │   │   ├── hooks/         # Data loading for components (useConversationList, useTrace)
    │   │   ├── components/    # UI for this feature (ConversationList, TraceDetail, IOPanel…)
    │   │   └── lib/           # Plain logic, no UI (conversation parsing, formatting)
    │   ├── review/            # Review bar, sidebar markers, keyboard shortcuts (lib/turns.ts: next/previous turn)
    │   └── theme/             # Light/dark mode switch (top-right button)
    │
    ├── components/ui/         # Small reusable pieces not tied to a feature (Badge, ErrorMessage)
    └── test/                  # Test setup (matchers, cleanup) and renderApp() for rendering the app at a URL
```

Tests live next to the file they test, named `*.test.ts(x)`.

### The layers, and which way they depend

```
pages  ──use──►  components  ──use──►  hooks  ──call──►  api/  ──HTTP──►  backend
                      │
                      └──use──►  lib/  (plain functions, easy to test)
```

- **`pages/`** decide what goes where on the screen for one URL. They read URL parts (like the experiment ID) and pass them down to feature components.

- **`api/`** knows URLs and HTTP. It doesn't know about React.
- **`hooks/`** wrap the `api/` functions with TanStack Query, which handles loading states, errors, caching and paging. Components get `{ data, error, isPending }` back.
- **`components/`** only render UI. They get data from hooks and never call `fetch` themselves.
- **`lib/`** holds logic with no UI. `messages.ts` turns the different agent formats (OpenAI chat, MLflow ResponsesAgent, LangChain…) into a common list of messages. If a format isn't recognised, the UI falls back to raw JSON.

## Common tasks

**The backend API changed (new field or endpoint).** Start the backend, then run `npm run gen:api`. TypeScript will point out (`npm run typecheck`) every place that needs updating. For a new endpoint, add a function in `src/api/`, then a hook in the feature's `hooks/` folder.

**A trace shows raw JSON instead of chat messages.** Its format isn't recognised yet. Add it to `src/features/traces/lib/messages.ts`, with a test in `messages.test.ts`.

**Styling for dark mode.** Dark mode works by adding `class="dark"` to the page's `<html>` tag. Every colour class needs a `dark:` partner, which only applies in dark mode. For example, `bg-white dark:bg-slate-900` or `text-slate-500 dark:text-slate-400`. Copy the pairs already used in existing components so the colours stay consistent. To check, click the sun/moon button at the top right.

**Adding a new feature**: create `src/features/<name>/` with the same `hooks/`, `components/` and `lib/` folders.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Could not load traces" with a 500 error | The backend can't reach Databricks: check `backend/.env` and run `databricks auth login --profile <name>` |
| "Could not load traces" with a 502/504, or `ECONNREFUSED` in the terminal | The backend isn't running (terminal 1) |
| `npm run dev` fails with an engine/version error | Node.js is too old. Install Node 20.19 or newer |
| Port 5173 already in use | Another `npm run dev` is still running. Stop it, or Vite picks the next free port (read the URL it prints) |
