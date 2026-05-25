from flask_restx import Namespace

public_ns = Namespace("public", description="Public campaign entry points")

from app.features.gifts import public_api as _gift_public_api  # noqa: E402,F401
from . import sponsor_public_api  # noqa: E402,F401

__all__ = ["public_ns"]
