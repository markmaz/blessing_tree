from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from logging.config import dictConfig
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


_RESERVED_LOG_RECORD_KEYS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__)


def _env_flag(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in ("1", "true", "yes", "y", "on")


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": os.getenv("BT_SERVICE_NAME", "blessing-tree-api"),
        }

        for key, value in record.__dict__.items():
            if key.startswith("_") or key in _RESERVED_LOG_RECORD_KEYS:
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str, separators=(",", ":"))


def configure_logging(service_name: str | None = None) -> None:
    load_dotenv()

    if service_name:
        os.environ["BT_SERVICE_NAME"] = service_name

    log_level = os.getenv("BT_LOG_LEVEL", os.getenv("LOG_LEVEL", "INFO")).upper()
    log_format = os.getenv("BT_LOG_FORMAT", "human").strip().lower()
    log_to_console = _env_flag("BT_LOG_TO_CONSOLE", True)
    log_to_file = _env_flag("BT_LOG_TO_FILE", True)
    log_file = os.getenv("BT_LOG_FILE") or os.getenv("LOG_FILE") or "logs/blessing-tree-api.log"
    max_bytes = _env_int("BT_LOG_MAX_BYTES", 10 * 1024 * 1024)
    backup_count = _env_int("BT_LOG_BACKUP_COUNT", 5)

    handlers: dict[str, dict[str, Any]] = {}
    root_handlers: list[str] = []
    formatter = "json" if log_format == "json" else "human"

    if log_to_console:
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": formatter,
            "stream": "ext://sys.stdout",
        }
        root_handlers.append("console")

    if log_to_file:
        log_path = Path(log_file)
        if log_path.parent != Path("."):
            log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": formatter,
            "filename": str(log_path),
            "maxBytes": max_bytes,
            "backupCount": backup_count,
            "encoding": "utf-8",
        }
        root_handlers.append("file")

    if not root_handlers:
        handlers["null"] = {"class": "logging.NullHandler"}
        root_handlers.append("null")

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "human": {
                    "format": "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
                },
                "json": {
                    "()": JsonLogFormatter,
                },
            },
            "handlers": handlers,
            "root": {
                "level": log_level,
                "handlers": root_handlers,
            },
            "loggers": {
                "urllib3": {"level": "WARNING"},
                "requests": {"level": "WARNING"},
                "sqlalchemy.engine": {"level": os.getenv("BT_SQL_LOG_LEVEL", "WARNING").upper()},
            },
        }
    )

    logging.getLogger(__name__).info(
        "Logging configured",
        extra={
            "log_format": log_format,
            "log_to_console": log_to_console,
            "log_to_file": log_to_file,
            "log_file": log_file if log_to_file else None,
        },
    )
