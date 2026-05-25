from flask_restx import Namespace

account_ns = Namespace("account", description="Current user account operations")

from . import api as _api  # noqa: F401,E402

__all__ = ["account_ns"]
