# human-evals

A simple UI for human review and error analysis of AI responses.

It reads traces (LLM inputs and outputs) from an MLflow experiment on Databricks and shows them to a human reviewer as readable conversations. Saving reviews (pass, or a written issue) back to MLflow as feedback comes next.

| Part | Tech | Docs |
|---|---|---|
| `backend/` | Python, FastAPI, MLflow SDK | [CLAUDE.md](CLAUDE.md#backend-backend) |
| `frontend/` | React, TypeScript, Vite, Tailwind | [frontend/README.md](frontend/README.md) |

## First-time setup

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 20.19+, and the [Databricks CLI](https://docs.databricks.com/dev-tools/cli/).

1. Log in to Databricks (opens a browser):
   ```bash
   databricks auth login --profile <profile-name>
   ```
2. Configure the backend:
   ```bash
   cd backend
   uv sync
   cp .env.example .env    # then set your profile name and experiment path
   ```
3. Install the frontend:
   ```bash
   cd frontend
   npm install
   ```

## Running

In two terminals:

```bash
# Terminal 1
cd backend && uv run uvicorn --factory app.main:create_app --reload

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173.
