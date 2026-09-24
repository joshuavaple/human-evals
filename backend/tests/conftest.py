import os

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--profile",
        default=os.environ.get("HUMAN_EVALS_DATABRICKS_PROFILE"),
        help="Databricks CLI profile (U2M) for integration tests",
    )
    parser.addoption(
        "--experiment",
        default=os.environ.get("HUMAN_EVALS_EXPERIMENT_NAME"),
        help="MLflow experiment name (workspace path) for integration tests",
    )
