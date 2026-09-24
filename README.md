# human-evals

A simple UI for human review and error analysis of AI responses.

You pick an MLflow experiment on Databricks (from the `/Shared` folder by default), and it shows that experiment's traces (LLM inputs and outputs) to a human reviewer as readable conversations. The reviewer marks each turn **Pass**, or reports an **Issue** with a written description, and the verdict is saved back to MLflow as feedback on the trace.

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
   cp .env.example .env    # then set your Databricks profile name
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
