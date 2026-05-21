from __future__ import annotations

import json
from pathlib import Path

_DEFAULT_VERSION = "0.0.0"


def get_backend_version() -> str:
    version_path = Path(__file__).resolve().parents[1] / "version.json"
    try:
        payload = json.loads(version_path.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return _DEFAULT_VERSION

    version = str(payload.get("version") or "").strip()
    return version or _DEFAULT_VERSION
