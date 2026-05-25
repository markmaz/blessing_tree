from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.campaigns.readiness_constants import SECTION_ACTION_LABELS
from app.models.app_feature_flag import AppFeatureFlag
from app.models.campaign_readiness_rule_definition import CampaignReadinessRuleDefinition


class CampaignReadinessDefinitionService:
    def build_configured_items(self, db: Session, *, campaign, milestones) -> list[dict[str, object]]:
        milestone_keys = {milestone.milestone_key for milestone in milestones}
        rules = (
            db.query(CampaignReadinessRuleDefinition)
            .filter(
                CampaignReadinessRuleDefinition.is_active == 1,
                CampaignReadinessRuleDefinition.rule_type == "MISSING_MILESTONE",
            )
            .order_by(CampaignReadinessRuleDefinition.feature_area.asc(), CampaignReadinessRuleDefinition.name.asc())
            .all()
        )
        items: list[dict[str, object]] = []
        for rule in rules:
            if not self._condition_matches(db, campaign, rule):
                continue
            if not rule.milestone_key or rule.milestone_key in milestone_keys:
                continue
            items.append(self._readiness_item(rule))
        return items

    def _condition_matches(self, db: Session, campaign, rule: CampaignReadinessRuleDefinition) -> bool:
        condition_type = rule.condition_type
        config = rule.condition_config_json or {}
        if condition_type == "ALWAYS":
            return True
        if condition_type == "CAMPAIGN_FIELD_TRUE":
            field = str(config.get("field") or "")
            if field not in {"public_sponsor_signup_enabled"}:
                return False
            return bool(getattr(campaign, field, False))
        if condition_type == "CAMPAIGN_STATUS_IS":
            return str(campaign.status).upper() == str(config.get("status") or "").upper()
        if condition_type == "FEATURE_ENABLED":
            feature_key = str(config.get("feature_key") or "")
            if not feature_key:
                return False
            flag = db.query(AppFeatureFlag).filter(AppFeatureFlag.feature_key == feature_key).one_or_none()
            return bool(flag and flag.is_enabled)
        return False

    @staticmethod
    def _readiness_item(rule: CampaignReadinessRuleDefinition) -> dict[str, object]:
        return {
            "severity": rule.severity,
            "category": rule.category,
            "code": rule.rule_key,
            "section": rule.section,
            "message": rule.message,
            "action_label": rule.action_label or SECTION_ACTION_LABELS.get(rule.section, "Open Settings"),
            "blocking_for": list(rule.blocking_for_json or []),
            "details": {
                "rule_id": str(rule.id),
                "rule_type": rule.rule_type,
                "milestone_key": rule.milestone_key,
            },
        }
