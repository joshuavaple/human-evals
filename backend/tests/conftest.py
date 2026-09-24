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
        default=os.environ.get("HUMAN_EVALS_TEST_EXPERIMENT"),
        help="Workspace path of an MLflow experiment with traces, e.g. /Shared/my-agent. "
        "Integration tests browse its parent folder.",
    )
