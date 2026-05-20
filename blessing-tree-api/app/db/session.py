from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import DB_URI, MAX_OVERFLOW, POOL_RECYCLE, POOL_SIZE, POOL_TIMEOUT

_engine = None
_SessionLocal = None


def _init_engine():
    global _engine, _SessionLocal
    if _engine is not None:
        return
    if not DB_URI:
        raise RuntimeError("DB_URI is not configured")
    _engine = create_engine(
        DB_URI,
        pool_size=POOL_SIZE,
        max_overflow=MAX_OVERFLOW,
        pool_timeout=POOL_TIMEOUT,
        pool_recycle=POOL_RECYCLE,
        pool_pre_ping=True,
    )
    _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


def SessionLocal():
    _init_engine()
    return _SessionLocal()
