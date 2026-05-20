from app.features.rbac.constants import (
    ALL_CAMPAIGN_CAPABILITIES,
    APP_ADMIN_ROLE,
    APP_USER_ROLE,
    CAMPAIGN_MANAGER_ROLE,
    CAMPAIGN_ROLE_CAPABILITIES,
    DONATION_ENTRY_ROLE,
    GIFT_CHECKIN_ROLE,
    RECIPIENT_COORDINATOR_ROLE,
    VOLUNTEER_VIEWER_ROLE,
    get_capabilities_for_campaign_role,
    normalize_app_role,
    normalize_campaign_role_key,
)
from app.features.rbac.decorators import require_app_admin, require_campaign_capability
from app.features.rbac.scope import resolve_campaign_scope_id

__all__ = [
    "ALL_CAMPAIGN_CAPABILITIES",
    "APP_ADMIN_ROLE",
    "APP_USER_ROLE",
    "CAMPAIGN_MANAGER_ROLE",
    "CAMPAIGN_ROLE_CAPABILITIES",
    "DONATION_ENTRY_ROLE",
    "GIFT_CHECKIN_ROLE",
    "RECIPIENT_COORDINATOR_ROLE",
    "VOLUNTEER_VIEWER_ROLE",
    "get_capabilities_for_campaign_role",
    "normalize_app_role",
    "normalize_campaign_role_key",
    "require_app_admin",
    "require_campaign_capability",
    "resolve_campaign_scope_id",
]
