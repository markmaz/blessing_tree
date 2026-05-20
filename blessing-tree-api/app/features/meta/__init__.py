from flask_restx import Namespace

meta_ns = Namespace("meta", description="Application metadata")

from . import api as _api  # noqa: F401,E402

__all__ = ["meta_ns"]
