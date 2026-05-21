from app.factory import build_cors_origins


def test_build_cors_origins_adds_loopback_variant_for_localhost() -> None:
    origins = build_cors_origins("http://localhost:5173")

    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins


def test_build_cors_origins_adds_loopback_variant_for_127001() -> None:
    origins = build_cors_origins("http://127.0.0.1:4173")

    assert "http://127.0.0.1:4173" in origins
    assert "http://localhost:4173" in origins
