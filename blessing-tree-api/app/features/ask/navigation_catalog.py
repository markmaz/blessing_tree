from __future__ import annotations

from app.features.ask.schemas import NavigationTarget


NAVIGATION_TARGETS: tuple[NavigationTarget, ...] = (
    NavigationTarget("dashboard", "Dashboard", ("dashboard", "home", "campaign snapshot"), "dashboard", "campaign.view"),
    NavigationTarget("campaign_studio", "Campaign Studio", ("campaign studio", "campaign setup", "studio"), "campaign_studio", "campaign.view"),
    NavigationTarget(
        "people_intake",
        "People Intake",
        (
            "people intake",
            "add recipient",
            "add person",
            "new child",
            "add child",
            "add adult",
            "create family",
            "create organization",
            "link family to organization",
        ),
        "campaign_people_intake",
        "campaign.recipients.edit",
    ),
    NavigationTarget(
        "people_directory",
        "People Directory",
        (
            "people directory",
            "recipient directory",
            "find people",
            "find recipient",
            "find family",
            "find organization",
            "linked families",
        ),
        "campaign_people_directory",
        "campaign.recipients.view",
    ),
    NavigationTarget("people_reports", "People Reports", ("people reports", "recipient reports", "people reporting"), "campaign_people_reports", "campaign.reports.view"),
    NavigationTarget("sponsor_intake", "Sponsor Intake", ("sponsor intake", "add sponsor", "new sponsor"), "campaign_sponsors_intake", "campaign.sponsors.manage"),
    NavigationTarget("sponsor_directory", "Sponsor Directory", ("sponsor directory", "find sponsor", "sponsor list"), "campaign_sponsors_directory", "campaign.sponsors.view"),
    NavigationTarget("sponsor_reports", "Sponsor Reports", ("sponsor reports", "sponsor reporting", "follow up queue"), "campaign_sponsors_reports", "campaign.reports.view"),
    NavigationTarget("gift_search", "Gift Search", ("gift search", "search gifts", "find gifts"), "campaign_gifts_search", "campaign.gifts.search"),
    NavigationTarget("gift_operations", "Gift Operations", ("gift operations", "receive gifts", "wrap gifts", "check in gifts"), "campaign_gifts_operations", "campaign.gifts.check_in"),
    NavigationTarget("gift_pool", "Gift Pool", ("gift pool", "donated inventory", "inventory", "unmatched donations"), "campaign_gifts_pool", "campaign.gifts.pool.manage"),
    NavigationTarget("gift_status", "Gift Status", ("gift status", "gift status report", "visual gift report", "gift report"), "campaign_gifts_reports", "campaign.reports.view"),
    NavigationTarget(
        "gift_tag_builder",
        "Gift Tag Builder",
        ("gift tag builder", "design gift tag", "edit gift tags", "gift tag template", "print blank tags"),
        "campaign_gifts_tag_builder",
        "campaign.admin",
    ),
    NavigationTarget(
        "sponsor_flyer",
        "Flyer Builder",
        ("sponsor flyer", "flyer", "print flyer", "flyer builder", "create flyer", "edit flyer"),
        "campaign_sponsor_flyer",
        "campaign.view",
    ),
    NavigationTarget("account_profile", "Profile", ("profile", "my profile"), "account_profile"),
    NavigationTarget("account_settings", "Settings", ("settings", "my settings", "user settings"), "account_settings"),
    NavigationTarget("admin_users", "User Management", ("user management", "users", "invite user", "app access"), "admin_users"),
    NavigationTarget("admin_campaign_operations", "Campaign Operations", ("campaign operations", "milestones", "readiness rules", "rule builder"), "admin_campaign_operations"),
    NavigationTarget(
        "admin_organization_types",
        "Organization Types",
        (
            "organization types",
            "organization type",
            "people served",
            "child organization",
            "adult organization",
            "family organization",
            "nursing home",
            "foster care",
            "mh clients",
            "mental health clients",
        ),
        "admin_organization_types",
    ),
    NavigationTarget("admin_llm", "LLM Configuration", ("llm settings", "ai settings", "llm configuration"), "admin_llm"),
)


def build_route(route_name: str, campaign_id: str) -> str:
    campaign_routes = {
        "dashboard": "/",
        "campaign_ask": f"/campaigns/{campaign_id}/ask",
        "campaign_studio": f"/campaigns/{campaign_id}/studio",
        "campaign_sponsor_flyer": f"/campaigns/{campaign_id}/studio/sponsor-flyer",
        "campaign_people_intake": f"/campaigns/{campaign_id}/people/intake",
        "campaign_people_directory": f"/campaigns/{campaign_id}/people/directory",
        "campaign_people_reports": f"/campaigns/{campaign_id}/people/reports",
        "campaign_sponsors_intake": f"/campaigns/{campaign_id}/sponsors/intake",
        "campaign_sponsors_directory": f"/campaigns/{campaign_id}/sponsors/directory",
        "campaign_sponsors_reports": f"/campaigns/{campaign_id}/sponsors/reports",
        "campaign_gifts_search": f"/campaigns/{campaign_id}/gifts/search",
        "campaign_gifts_operations": f"/campaigns/{campaign_id}/gifts/operations",
        "campaign_gifts_pool": f"/campaigns/{campaign_id}/gifts/pool",
        "campaign_gifts_reports": f"/campaigns/{campaign_id}/gifts/reports",
        "campaign_gifts_tag_builder": f"/campaigns/{campaign_id}/gifts/tag-builder",
    }
    static_routes = {
        "account_profile": "/account/profile",
        "account_settings": "/account/settings",
        "admin_users": "/admin/users",
        "admin_campaign_operations": "/admin/campaign-operations",
        "admin_organization_types": "/admin/organization-types",
        "admin_llm": "/admin/llm",
    }
    return campaign_routes.get(route_name) or static_routes.get(route_name) or "/"
