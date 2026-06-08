from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.features.admin.audit_service import AuditEventService
from app.features.recipients.service import CampaignRecipientService


def run_backfill(db: Session, campaign_id: str, *, apply: bool) -> dict[str, object]:
    service = CampaignRecipientService()
    summary = service.backfill_family_program_ids(db, campaign_id, dry_run=not apply)
    payload = {
        "campaign_id": campaign_id,
        "mode": "apply" if apply else "dry-run",
        **summary,
    }
    if apply:
        AuditEventService().record_event(
            db,
            area="people",
            action="updated",
            entity_type="campaign",
            entity_id=campaign_id,
            entity_label="Family group ID backfill",
            campaign_id=campaign_id,
            summary=(
                "Backfilled family group IDs for "
                f"{summary['groups_updated']} groups and {summary['recipients_updated']} recipients."
            ),
            changes=[
                {
                    "field": "family_program_ids",
                    "label": "Family and Recipient IDs",
                    "before": "legacy or missing family IDs",
                    "after": (
                        f"{summary['groups_updated']} family group IDs and "
                        f"{summary['recipients_updated']} suffixed recipient IDs updated"
                    ),
                }
            ],
            metadata={"reason": "backfill", **summary},
        )
        db.commit()
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill family group IDs and suffixed child recipient IDs for one campaign."
    )
    parser.add_argument("--campaign-id", required=True, help="Campaign UUID to backfill.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist the backfill. Without this flag the command rolls back after reporting the planned changes.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    with SessionLocal() as db:
        summary = run_backfill(db, args.campaign_id, apply=args.apply)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
