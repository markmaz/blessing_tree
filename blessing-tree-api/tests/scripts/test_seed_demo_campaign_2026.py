import pytest

from scripts.seed_demo_campaign_2026 import enforce_environment_safety


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
