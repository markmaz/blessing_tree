from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.admin.campaign_operations_validation import (
    validate_milestone_definition_payload,
    validate_readiness_rule_payload,
)
from app.features.campaigns.readiness_definition_constants import (
    CAMPAIGN_MILESTONE_FEATURE_AREAS,
    CAMPAIGN_READINESS_ALLOWED_CAMPAIGN_FIELDS,
    CAMPAIGN_READINESS_CATEGORIES,
    CAMPAIGN_READINESS_CONDITION_TYPES,
    CAMPAIGN_READINESS_PHASES,
    CAMPAIGN_READINESS_RULE_TYPES,
    CAMPAIGN_READINESS_SECTIONS,
    CAMPAIGN_READINESS_SEVERITIES,
)
from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
from app.models.campaign_readiness_rule_definition import CampaignReadinessRuleDefinition


class CampaignOperationsAdminService:
    def list_milestone_definitions(self, db: Session) -> list[CampaignMilestoneDefinition]:
        return (
            db.query(CampaignMilestoneDefinition)
            .order_by(CampaignMilestoneDefinition.default_sort_order.asc(), CampaignMilestoneDefinition.label.asc())
            .all()
        )

    def create_milestone_definition(self, db: Session, payload: dict[str, object]) -> CampaignMilestoneDefinition:
        values = validate_milestone_definition_payload(payload)
        definition = CampaignMilestoneDefinition(id=uuid.uuid4(), **values)
        db.add(definition)
        self._commit_or_conflict(db, "Milestone definition already exists")
        return self.get_milestone_definition(db, str(definition.id))

    def update_milestone_definition(self, db: Session, definition_id: str, payload: dict[str, object]) -> CampaignMilestoneDefinition:
        definition = self.get_milestone_definition(db, definition_id)
        values = validate_milestone_definition_payload(payload, partial=True)
        values.pop("milestone_key", None)
        if values.get("is_active") is False and definition.is_active:
            self._validate_milestone_definition_can_deactivate(db, definition)
        for key, value in values.items():
            setattr(definition, key, value)
        self._commit_or_conflict(db, "Milestone definition already exists")
        return self.get_milestone_definition(db, definition_id)

    def get_milestone_definition(self, db: Session, definition_id: str) -> CampaignMilestoneDefinition:
        definition = db.query(CampaignMilestoneDefinition).filter(CampaignMilestoneDefinition.id == uuid.UUID(definition_id)).one_or_none()
        if definition is None:
            raise ServiceError("Milestone definition not found", status_code=404, details={"id": definition_id})
        return definition

    def list_readiness_rules(self, db: Session) -> list[CampaignReadinessRuleDefinition]:
        return (
            db.query(CampaignReadinessRuleDefinition)
            .order_by(CampaignReadinessRuleDefinition.feature_area.asc(), CampaignReadinessRuleDefinition.name.asc())
            .all()
        )

    def create_readiness_rule(self, db: Session, payload: dict[str, object]) -> CampaignReadinessRuleDefinition:
        values = validate_readiness_rule_payload(payload)
        self._validate_rule_references_active_milestone(db, values.get("milestone_key"))
        rule = CampaignReadinessRuleDefinition(id=uuid.uuid4(), **values)
        db.add(rule)
        self._commit_or_conflict(db, "Readiness rule already exists")
        return self.get_readiness_rule(db, str(rule.id))

    def update_readiness_rule(self, db: Session, rule_id: str, payload: dict[str, object]) -> CampaignReadinessRuleDefinition:
        rule = self.get_readiness_rule(db, rule_id)
        patched_payload = {
            **payload,
            "existing_condition_type": payload.get("condition_type", rule.condition_type),
        }
        values = validate_readiness_rule_payload(patched_payload, partial=True)
        values.pop("rule_key", None)
        self._validate_rule_references_active_milestone(db, values.get("milestone_key", rule.milestone_key))
        for key, value in values.items():
            setattr(rule, key, value)
        self._commit_or_conflict(db, "Readiness rule already exists")
        return self.get_readiness_rule(db, rule_id)

    def get_readiness_rule(self, db: Session, rule_id: str) -> CampaignReadinessRuleDefinition:
        rule = db.query(CampaignReadinessRuleDefinition).filter(CampaignReadinessRuleDefinition.id == uuid.UUID(rule_id)).one_or_none()
        if rule is None:
            raise ServiceError("Readiness rule not found", status_code=404, details={"id": rule_id})
        return rule

    def readiness_rule_options(self, db: Session) -> dict[str, object]:
        active_milestones = (
            db.query(CampaignMilestoneDefinition)
            .filter(CampaignMilestoneDefinition.is_active == 1)
            .order_by(CampaignMilestoneDefinition.default_sort_order.asc(), CampaignMilestoneDefinition.label.asc())
            .all()
        )
        return {
            "feature_areas": sorted(CAMPAIGN_MILESTONE_FEATURE_AREAS),
            "rule_types": sorted(CAMPAIGN_READINESS_RULE_TYPES),
            "condition_types": sorted(CAMPAIGN_READINESS_CONDITION_TYPES),
            "allowed_campaign_fields": sorted(CAMPAIGN_READINESS_ALLOWED_CAMPAIGN_FIELDS),
            "severities": sorted(CAMPAIGN_READINESS_SEVERITIES),
            "categories": sorted(CAMPAIGN_READINESS_CATEGORIES),
            "phases": sorted(CAMPAIGN_READINESS_PHASES),
            "sections": sorted(CAMPAIGN_READINESS_SECTIONS),
            "milestone_definitions": active_milestones,
        }

    def _validate_rule_references_active_milestone(self, db: Session, milestone_key: object) -> None:
        if not milestone_key:
            return
        definition = (
            db.query(CampaignMilestoneDefinition)
            .filter(
                CampaignMilestoneDefinition.milestone_key == str(milestone_key),
                CampaignMilestoneDefinition.is_active == 1,
            )
            .one_or_none()
        )
        if definition is None:
            raise ServiceError(
                "Readiness rule references an inactive or unknown milestone",
                status_code=400,
                details={"field": "milestone_key"},
            )

    def _validate_milestone_definition_can_deactivate(
        self,
        db: Session,
        definition: CampaignMilestoneDefinition,
    ) -> None:
        active_rule_count = (
            db.query(CampaignReadinessRuleDefinition)
            .filter(
                CampaignReadinessRuleDefinition.milestone_key == definition.milestone_key,
                CampaignReadinessRuleDefinition.is_active == 1,
            )
            .count()
        )
        if active_rule_count:
            raise ServiceError(
                "Milestone definition cannot be deactivated while active readiness rules reference it",
                status_code=409,
                details={
                    "milestone_key": definition.milestone_key,
                    "active_readiness_rule_count": active_rule_count,
                },
            )

    @staticmethod
    def _commit_or_conflict(db: Session, message: str) -> None:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ServiceError(message, status_code=409)
