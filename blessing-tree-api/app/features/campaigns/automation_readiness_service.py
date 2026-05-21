from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.campaigns.automation_repository import CampaignAutomationRepository
from app.features.campaigns.runtime_health import campaign_worker_is_healthy


class CampaignAutomationReadinessService:
    def __init__(self, repository: CampaignAutomationRepository | None = None) -> None:
        self.repository = repository or CampaignAutomationRepository()

    def build_snapshot(
        self,
        db: Session,
        *,
        campaign_id: str,
        schedules,
    ) -> dict[str, object]:
        active_schedules = [schedule for schedule in schedules if schedule.status != "DISABLED"]
        if not active_schedules:
            return {
                "has_active_schedules": False,
                "worker_healthy": False,
                "recent_issue_count": 0,
            }

        return {
            "has_active_schedules": True,
            "worker_healthy": campaign_worker_is_healthy(),
            "recent_issue_count": self.repository.count_recent_execution_issues(
                db,
                campaign_id=campaign_id,
            ),
        }
