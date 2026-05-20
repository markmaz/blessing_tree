from __future__ import annotations

import uuid

from sqlalchemy.dialects.mysql import BINARY
from sqlalchemy.types import TypeDecorator


class UUIDBin(TypeDecorator):
    """
    Stores uuid.UUID as BINARY(16) with MySQL "swap" byte order that matches:
      UUID_TO_BIN(uuid_string, true)
    and reads back compatible with:
      BIN_TO_UUID(bin, true)

    In python you work with uuid.UUID objects.
    """
    impl = BINARY(16)
    cache_ok = True

    @staticmethod
    def _swap_uuid_bytes(b: bytes) -> bytes:
        # MySQL swap order for UUID_TO_BIN(..., true):
        # time_low (4) + time_mid (2) + time_hi_and_version (2) + rest (8)
        # becomes: time_hi_and_version (2) + time_mid (2) + time_low (4) + rest (8)
        # Actually MySQL swaps the first 8 bytes as: (4)(2)(2) -> (2)(2)(4)
        return b[6:8] + b[4:6] + b[0:4] + b[8:16]

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            value = uuid.UUID(value)
        if not isinstance(value, uuid.UUID):
            raise TypeError(f"UUIDBin expects uuid.UUID or str, got {type(value)}")
        return self._swap_uuid_bytes(value.bytes)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # reverse swap: (2)(2)(4) -> (4)(2)(2)
        b = bytes(value)
        unswapped = b[4:8] + b[2:4] + b[0:2] + b[8:16]
        return uuid.UUID(bytes=unswapped)
