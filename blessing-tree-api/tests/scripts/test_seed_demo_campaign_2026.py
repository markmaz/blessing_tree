import pytest

from scripts.seed_demo_campaign_2026 import (
    enforce_environment_safety,
    validate_seed_family_id_values,
    validate_seed_recipient_id_values,
)


def test_seed_reset_is_refused_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURRENT_ENVIRONMENT", "production")

    with pytest.raises(SystemExit, match="Refusing to run --reset"):
        enforce_environment_safety(reset=True, append=False, allow_production_replace=False)


def test_seed_replace_requires_explicit_override_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURRENT_ENVIRONMENT", "production")

    with pytest.raises(SystemExit, match="Refusing to replace seeded campaign data"):
        enforce_environment_safety(reset=False, append=False, allow_production_replace=False)


def test_seed_append_is_allowed_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURRENT_ENVIRONMENT", "production")

    enforce_environment_safety(reset=False, append=True, allow_production_replace=False)


def test_seed_replace_override_is_allowed_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURRENT_ENVIRONMENT", "production")

    enforce_environment_safety(reset=False, append=False, allow_production_replace=True)


def test_seed_safety_does_not_block_local_reset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURRENT_ENVIRONMENT", "development")

    enforce_environment_safety(reset=True, append=False, allow_production_replace=False)


def test_seed_family_id_validation_requires_full_bt_sequence() -> None:
    validate_seed_family_id_values([f"BT-{index:03d}" for index in range(1, 101)])

    with pytest.raises(RuntimeError, match="BT-001 through BT-100"):
        validate_seed_family_id_values(["BT-001", "BT-003"])


def test_seed_recipient_id_validation_requires_family_prefix_and_unique_suffixes() -> None:
    validate_seed_recipient_id_values(["BT-001-01", "BT-001-02", "BT-002-01"], {"BT-001", "BT-002"})

    with pytest.raises(RuntimeError, match="duplicates"):
        validate_seed_recipient_id_values(["BT-001-01", "BT-001-01"], {"BT-001"})

    with pytest.raises(RuntimeError, match="family ID scheme"):
        validate_seed_recipient_id_values(["BT-999-01"], {"BT-001"})
