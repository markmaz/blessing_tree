from __future__ import annotations

from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
from app.models.campaign_readiness_rule_definition import CampaignReadinessRuleDefinition


def serialize_milestone_definition(definition: CampaignMilestoneDefinition) -> dict[str, object]:
    return {
        "id": str(definition.id),
        "milestone_key": definition.milestone_key,
        "label": definition.label,
        "description": definition.description,
        "feature_area": definition.feature_area,
        "default_sort_order": definition.default_sort_order,
        "is_active": bool(definition.is_active),
        "is_system": bool(definition.is_system),
        "created_at": definition.created_at.isoformat(),
        "updated_at": definition.updated_at.isoformat(),
    }


def serialize_readiness_rule(rule: CampaignReadinessRuleDefinition) -> dict[str, object]:
    return {
        "id": str(rule.id),
        "rule_key": rule.rule_key,
        "name": rule.name,
        "description": rule.description,
        "rule_type": rule.rule_type,
        "feature_area": rule.feature_area,
        "condition_type": rule.condition_type,
        "condition_config": rule.condition_config_json,
        "milestone_key": rule.milestone_key,
        "severity": rule.severity,
        "category": rule.category,
        "blocking_for": list(rule.blocking_for_json or []),
        "section": rule.section,
        "action_label": rule.action_label,
        "message": rule.message,
        "is_active": bool(rule.is_active),
        "is_system": bool(rule.is_system),
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat(),
    }
