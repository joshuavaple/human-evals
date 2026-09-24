from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import conversations, experiments, reviews, traces
from app.config import Settings, get_settings
from app.repositories.mlflow_repo import ExperimentNotFoundError, TraceNotFoundError


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="human-evals")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(experiments.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(traces.router, prefix="/api")
    app.include_router(reviews.router, prefix="/api")

    @app.exception_handler(ExperimentNotFoundError)
    def experiment_not_found(_: Request, exc: ExperimentNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Experiment not found: {exc}"})

    @app.exception_handler(TraceNotFoundError)
    def trace_not_found(_: Request, exc: TraceNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Trace not found: {exc}"})

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
