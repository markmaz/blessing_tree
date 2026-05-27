from flask_restx import Namespace

campaign_ns = Namespace("campaigns", description="Campaign operations")

from . import api as _api  # noqa: F401,E402
from app.features.ask import api as _ask_api  # noqa: F401,E402
from app.features.gifts import api as _gift_api  # noqa: F401,E402
from . import recipient_api as _recipient_api  # noqa: F401,E402
from . import sponsor_api as _sponsor_api  # noqa: F401,E402
from . import studio_api as _studio_api  # noqa: F401,E402
from . import team_api as _team_api  # noqa: F401,E402

__all__ = ["campaign_ns"]
