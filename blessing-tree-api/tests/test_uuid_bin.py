import uuid

import pytest

from app.models.uuid_bin import UUIDBin


def test_uuid_bin_roundtrip() -> None:
    uuid_bin = UUIDBin()
    value = uuid.uuid4()
    bound = uuid_bin.process_bind_param(value, None)
    assert isinstance(bound, (bytes, bytearray))
    restored = uuid_bin.process_result_value(bound, None)
    assert restored == value


def test_uuid_bin_accepts_str() -> None:
    uuid_bin = UUIDBin()
    value = uuid.uuid4()
    bound = uuid_bin.process_bind_param(str(value), None)
    restored = uuid_bin.process_result_value(bound, None)
    assert restored == value


def test_uuid_bin_rejects_invalid_type() -> None:
    uuid_bin = UUIDBin()
    with pytest.raises(TypeError):
        uuid_bin.process_bind_param(123, None)


def test_uuid_bin_none_passthrough() -> None:
    uuid_bin = UUIDBin()
    assert uuid_bin.process_bind_param(None, None) is None
    assert uuid_bin.process_result_value(None, None) is None
