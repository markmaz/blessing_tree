from __future__ import annotations

import os
from typing import Optional

import valkey

_client: Optional[valkey.StrictValkey] = None


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_client() -> valkey.StrictValkey:
    global _client
    if _client is not None:
        return _client

    host = os.getenv("VALKEY_ADDRESS") or os.getenv("VALKEY_HOST", "localhost")
    port = int(os.getenv("VALKEY_PORT", "6379"))
    db = int(os.getenv("VALKEY_DB", "0"))
    password = os.getenv("VALKEY_PASSWORD")
    ssl = _to_bool(os.getenv("VALKEY_SSL"))

    _client = valkey.StrictValkey(
        host=host,
        port=port,
        db=db,
        password=password,
        ssl=ssl,
        decode_responses=True,
    )
    return _client
