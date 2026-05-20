from flask_restx import Namespace

campaign_ns = Namespace("campaigns", description="Campaign operations")

from . import api as _api  # noqa: F401,E402
from . import studio_api as _studio_api  # noqa: F401,E402

__all__ = ["campaign_ns"]
