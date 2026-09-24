from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import conversations, traces
from app.config import Settings, get_settings
from app.repositories.mlflow_repo import ExperimentNotFoundError


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="human-evals")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(traces.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")

    @app.exception_handler(ExperimentNotFoundError)
    def experiment_not_found(_: Request, exc: ExperimentNotFoundError) -> JSONResponse:
        # The configured experiment is wrong: a server misconfiguration, not a client error.
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
