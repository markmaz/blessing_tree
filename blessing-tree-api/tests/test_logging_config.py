import json
import logging

from app.config.logging_config import JsonLogFormatter, configure_logging


def test_json_log_formatter_includes_operational_fields() -> None:
    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="app.request",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="HTTP request completed",
        args=(),
        exc_info=None,
    )
    record.correlation_id = "corr-1"
    record.status_code = 200
    record.duration_ms = 42

    payload = json.loads(formatter.format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.request"
    assert payload["message"] == "HTTP request completed"
    assert payload["correlation_id"] == "corr-1"
    assert payload["status_code"] == 200
    assert payload["duration_ms"] == 42


def test_configure_logging_writes_rotating_local_log_file(monkeypatch, tmp_path) -> None:
    log_file = tmp_path / "blessing-tree-api.log"
    monkeypatch.setenv("BT_LOG_LEVEL", "INFO")
    monkeypatch.setenv("BT_LOG_FORMAT", "human")
    monkeypatch.setenv("BT_LOG_TO_CONSOLE", "false")
    monkeypatch.setenv("BT_LOG_TO_FILE", "true")
    monkeypatch.setenv("BT_LOG_FILE", str(log_file))

    configure_logging(service_name="test-service")

    logging.getLogger("test.local").info("local log entry")
    for handler in logging.getLogger().handlers:
        handler.flush()

    assert log_file.exists()
    assert "local log entry" in log_file.read_text(encoding="utf-8")
