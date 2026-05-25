from __future__ import annotations

DEFAULT_INVITE_TTL_HOURS = 24 * 7

FEATURE_FLAG_CATALOG = (
    {
        "feature_key": "people",
        "label": "People",
        "description": "Show the campaign-aware People workspace in the main application navigation.",
        "default_enabled": True,
    },
    {
        "feature_key": "sponsors",
        "label": "Sponsors",
        "description": "Show the campaign-aware Sponsors workspace in the main application navigation.",
        "default_enabled": True,
    },
    {
        "feature_key": "donations",
        "label": "Donations",
        "description": "Enable the Donations workspace and navigation entry.",
        "default_enabled": True,
    },
    {
        "feature_key": "reports",
        "label": "Reports",
        "description": "Enable the Reports area and related navigation.",
        "default_enabled": True,
    },
    {
        "feature_key": "campaign_ai",
        "label": "Campaign AI",
        "description": "Allow AI drafting and apply flows inside Campaign Studio.",
        "default_enabled": True,
    },
)

GLOBAL_APP_ROLE_CATALOG = (
    {
        "role_key": "ADMIN",
        "label": "Administrator",
        "description": "Full application administration access.",
    },
    {
        "role_key": "COORDINATOR",
        "label": "Standard User",
        "description": "General application access without app-wide admin permissions.",
    },
)

LLM_PROVIDER_CATALOG = (
    {
        "provider": "OPENAI_COMPATIBLE",
        "label": "OpenAI-Compatible",
        "description": "Any OpenAI-compatible endpoint, including vLLM-style `/v1/models` servers.",
    },
    {
        "provider": "OPENAI",
        "label": "OpenAI",
        "description": "Direct OpenAI API endpoint using the same compatible health probe shape.",
    },
)
