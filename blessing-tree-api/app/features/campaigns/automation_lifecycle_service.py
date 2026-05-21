from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.campaigns.automation_constants import (
    CAMPAIGN_AUTOMATION_EXECUTION_LIFECYCLE,
    CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
    CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
    CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
)
from app.features.campaigns.automation_repository import CampaignAutomationRepository
from app.features.campaigns.constants import CAMPAIGN_STATUS_ACTIVE, CAMPAIGN_STATUS_CLOSED
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.campaigns.studio_constants import READINESS_READY


class CampaignAutomationLifecycleService:
    def __init__(
        self,
        repository: CampaignAutomationRepository | None = None,
        campaign_service: CampaignService | None = None,
        studio_service: CampaignStudioService | None = None,
    ) -> None:
        self.repository = repository or CampaignAutomationRepository()
        self.campaigns = campaign_service or CampaignService()
        self.studio = studio_service or CampaignStudioService(self.campaigns)

    def activate_campaign(self, db: Session, *, campaign_id: str) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        execution = self.repository.create_execution(
            db,
            campaign_id=campaign.id,
            schedule_id=None,
            execution_type=CAMPAIGN_AUTOMATION_EXECUTION_LIFECYCLE,
            action_key="activate_campaign",
        )

        if campaign.status != "DRAFT":
            self.repository.complete_execution(
                db,
                execution=execution,
                status=CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
                details={"reason": "campaign_not_in_draft"},
            )
            db.commit()
            return {"campaign_id": str(campaign.id), "status": CAMPAIGN_AUTOMATION_STATUS_SKIPPED}

        readiness = self.studio.get_readiness(db, campaign_id)
        if readiness["phase_status"].get("activate") != READINESS_READY:
            self.repository.complete_execution(
                db,
                execution=execution,
                status=CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
                details={
                    "reason": "activation_not_ready",
                    "phase_status": readiness["phase_status"],
                    "blocking_codes": [
                        item["code"]
                        for item in readiness["items"]
                        if "activate" in item.get("blocking_for", [])
                    ],
                },
                error_message="Campaign activation is blocked by readiness checks.",
            )
            db.commit()
            return {"campaign_id": str(campaign.id), "status": CAMPAIGN_AUTOMATION_STATUS_BLOCKED}

        campaign.status = CAMPAIGN_STATUS_ACTIVE
        self.repository.complete_execution(
            db,
            execution=execution,
            status=CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
            details={"next_status": CAMPAIGN_STATUS_ACTIVE},
        )
        db.commit()
        return {"campaign_id": str(campaign.id), "status": CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED}

    def close_campaign(self, db: Session, *, campaign_id: str) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        execution = self.repository.create_execution(
            db,
            campaign_id=campaign.id,
            schedule_id=None,
            execution_type=CAMPAIGN_AUTOMATION_EXECUTION_LIFECYCLE,
            action_key="close_campaign",
        )

        if campaign.status != "ACTIVE":
            self.repository.complete_execution(
                db,
                execution=execution,
                status=CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
                details={"reason": "campaign_not_active"},
            )
            db.commit()
            return {"campaign_id": str(campaign.id), "status": CAMPAIGN_AUTOMATION_STATUS_SKIPPED}

        campaign.status = CAMPAIGN_STATUS_CLOSED
        self.repository.complete_execution(
            db,
            execution=execution,
            status=CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
            details={"next_status": CAMPAIGN_STATUS_CLOSED},
        )
        db.commit()
        return {"campaign_id": str(campaign.id), "status": CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED}
