from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.campaign_milestone_definition import CampaignMilestoneDefinition


class CampaignMilestoneDefinitionService:
    def list_active_definitions(self, db: Session) -> list[CampaignMilestoneDefinition]:
        return (
            db.query(CampaignMilestoneDefinition)
            .filter(CampaignMilestoneDefinition.is_active == 1)
            .order_by(CampaignMilestoneDefinition.default_sort_order.asc(), CampaignMilestoneDefinition.label.asc())
            .all()
        )

    def get_active_definition_defaults(self, db: Session) -> dict[str, dict[str, object]]:
        return {
            definition.milestone_key: {
                "label": definition.label,
                "sort_order": definition.default_sort_order,
            }
            for definition in self.list_active_definitions(db)
        }
