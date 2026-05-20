from __future__ import annotations

import json
from pathlib import Path

import pytest
from flask import Flask
from flask_restx import Api

from app.features.meta import meta_ns


@pytest.fixture
def app() -> Flask:
    app = Flask(__name__)
    api = Api(app)
    api.add_namespace(meta_ns, path="/api/v1/meta")
    return app


def test_get_version_returns_backend_version(app: Flask) -> None:
    client = app.test_client()

    response = client.get("/api/v1/meta/version")

    assert response.status_code == 200
    payload = response.get_json()
    version_path = Path(__file__).resolve().parents[3] / "version.json"
    expected_version = json.loads(version_path.read_text())["version"]
    assert payload == {"backend_version": expected_version}
