from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.features.campaigns.studio_constants import (
    COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT,
    COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT,
    COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT,
    COMMUNICATION_AUDIENCE_MANAGER,
    COMMUNICATION_AUDIENCE_ORGANIZATION_CONTACT,
    COMMUNICATION_AUDIENCE_SPONSOR,
    COMMUNICATION_AUDIENCE_VOLUNTEER,
)
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_GROUP_TYPE_ORGANIZATION,
    RECIPIENT_KIND_ADULT,
)
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
from app.models.sponsorship import Sponsorship


@dataclass(frozen=True)
class ResolvedCampaignRecipient:
    email: str
    display_name: str
    merge_fields: dict[str, str]
    sponsor_id: str | None = None


class CampaignRecipientResolver:
    def resolve_for_audience(
        self,
        db: Session,
        *,
        campaign_id: str,
        audience: str,
    ) -> list[ResolvedCampaignRecipient]:
        normalized_audience = str(audience or "GENERAL").strip().upper()
        if normalized_audience == COMMUNICATION_AUDIENCE_VOLUNTEER:
            return self._resolve_campaign_members(db, campaign_id=campaign_id, member_type="volunteer")
        if normalized_audience == COMMUNICATION_AUDIENCE_MANAGER:
            return self._resolve_managers(db, campaign_id=campaign_id)
        if normalized_audience == COMMUNICATION_AUDIENCE_SPONSOR:
            return self._resolve_sponsors(db, campaign_id=campaign_id)
        if normalized_audience == COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT:
            return self._resolve_group_contacts(
                db,
                campaign_id=campaign_id,
                group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
            )
        if normalized_audience == COMMUNICATION_AUDIENCE_ORGANIZATION_CONTACT:
            return self._resolve_group_contacts(
                db,
                campaign_id=campaign_id,
                group_type=RECIPIENT_GROUP_TYPE_ORGANIZATION,
            )
        if normalized_audience == COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT:
            return self._resolve_group_contacts(
                db,
                campaign_id=campaign_id,
                group_type=None,
                primary_only=True,
            )
        if normalized_audience == COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT:
            return self._resolve_direct_recipient_contacts(
                db,
                campaign_id=campaign_id,
            )
        return self._resolve_campaign_members(db, campaign_id=campaign_id, member_type=None)

    def _resolve_campaign_members(
        self,
        db: Session,
        *,
        campaign_id: str,
        member_type: str | None,
    ) -> list[ResolvedCampaignRecipient]:
        query = (
            db.query(CampaignMember)
            .filter(CampaignMember.campaign_id == campaign_id, CampaignMember.is_active == 1)
            .order_by(CampaignMember.display_name.asc())
        )
        if member_type is not None:
            query = query.filter(CampaignMember.member_type == member_type)
        members = query.all()

        recipients: list[ResolvedCampaignRecipient] = []
        for member in members:
            email = self._resolve_member_email(member)
            if not email:
                continue
            recipients.append(
                ResolvedCampaignRecipient(
                    email=email,
                    display_name=member.display_name,
                    merge_fields={
                        "volunteer.first_name": _first_name(member.display_name),
                        "volunteer.full_name": member.display_name,
                        "manager.name": member.display_name,
                    },
                )
            )
        return _dedupe_recipients(recipients)

    def _resolve_managers(self, db: Session, *, campaign_id: str) -> list[ResolvedCampaignRecipient]:
        recipients: list[ResolvedCampaignRecipient] = []

        member_rows = (
            db.query(CampaignMember)
            .join(
                CampaignMemberAccessRole,
                CampaignMemberAccessRole.campaign_member_id == CampaignMember.id,
            )
            .filter(
                CampaignMember.campaign_id == campaign_id,
                CampaignMember.is_active == 1,
                CampaignMemberAccessRole.is_active == 1,
                CampaignMemberAccessRole.role_key == CAMPAIGN_MANAGER_ROLE,
            )
            .order_by(CampaignMember.display_name.asc())
            .all()
        )
        for member in member_rows:
            email = self._resolve_member_email(member)
            if not email:
                continue
            recipients.append(
                ResolvedCampaignRecipient(
                    email=email,
                    display_name=member.display_name,
                    merge_fields={
                        "manager.name": member.display_name,
                    },
                )
            )

        legacy_rows = (
            db.query(CampaignUserRole)
            .filter(
                CampaignUserRole.campaign_id == campaign_id,
                CampaignUserRole.is_active == 1,
                CampaignUserRole.role_key == CAMPAIGN_MANAGER_ROLE,
            )
            .order_by(CampaignUserRole.created_at.asc())
            .all()
        )
        for assignment in legacy_rows:
            if not assignment.user or not assignment.user.is_active or not assignment.user.email:
                continue
            recipients.append(
                ResolvedCampaignRecipient(
                    email=assignment.user.email,
                    display_name=assignment.user.display_name,
                    merge_fields={
                        "manager.name": assignment.user.display_name,
                    },
                )
            )

        return _dedupe_recipients(recipients)

    def _resolve_sponsors(self, db: Session, *, campaign_id: str) -> list[ResolvedCampaignRecipient]:
        sponsor_rows = (
            db.query(Sponsor)
            .join(Sponsorship, Sponsorship.sponsor_id == Sponsor.id)
            .filter(
                Sponsorship.campaign_id == campaign_id,
                Sponsor.is_active == 1,
                Sponsor.email.isnot(None),
                func.length(func.trim(Sponsor.email)) > 0,
            )
            .order_by(Sponsor.display_name.asc())
            .distinct()
            .all()
        )

        recipients = [
            ResolvedCampaignRecipient(
                email=str(sponsor.email).strip().lower(),
                display_name=sponsor.display_name,
                merge_fields={
                    "sponsor.first_name": _first_name(sponsor.display_name),
                    "sponsor.full_name": sponsor.display_name,
                },
                sponsor_id=str(sponsor.id),
            )
            for sponsor in sponsor_rows
            if sponsor.email
        ]
        return _dedupe_recipients(recipients)

    def _resolve_group_contacts(
        self,
        db: Session,
        *,
        campaign_id: str,
        group_type: str | None,
        primary_only: bool = False,
    ) -> list[ResolvedCampaignRecipient]:
        contact_rows = (
            db.query(GroupContact)
            .join(RecipientGroup, RecipientGroup.id == GroupContact.recipient_group_id)
            .filter(
                RecipientGroup.campaign_id == campaign_id,
                GroupContact.email.isnot(None),
                func.length(func.trim(GroupContact.email)) > 0,
            )
            .order_by(GroupContact.is_primary.desc(), GroupContact.created_at.asc())
        )
        if group_type is not None:
            contact_rows = contact_rows.filter(RecipientGroup.group_type == group_type)
        if primary_only:
            contact_rows = contact_rows.filter(GroupContact.is_primary == 1)
        contact_rows = contact_rows.all()

        recipients = []
        for contact in contact_rows:
            full_name = " ".join(
                part for part in [contact.first_name or "", contact.last_name or ""] if part
            ).strip() or "Family Contact"
            recipients.append(
                ResolvedCampaignRecipient(
                    email=str(contact.email).strip().lower(),
                    display_name=full_name,
                    merge_fields={
                        "contact.first_name": contact.first_name or full_name,
                        "contact.full_name": full_name,
                        "group.name": contact.recipient_group.group_name if contact.recipient_group else "",
                        "recipient.first_name": contact.first_name or full_name,
                        "recipient.full_name": full_name,
                    },
                )
            )
        return _dedupe_recipients(recipients)

    def _resolve_direct_recipient_contacts(
        self,
        db: Session,
        *,
        campaign_id: str,
    ) -> list[ResolvedCampaignRecipient]:
        recipient_rows = (
            db.query(Recipient)
            .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
            .filter(
                Recipient.campaign_id == campaign_id,
                Recipient.status == "ACTIVE",
                Recipient.recipient_kind == RECIPIENT_KIND_ADULT,
                Recipient.direct_email.isnot(None),
                func.length(func.trim(Recipient.direct_email)) > 0,
            )
            .order_by(Recipient.display_label.asc())
            .all()
        )

        recipients = [
            ResolvedCampaignRecipient(
                email=str(recipient.direct_email).strip().lower(),
                display_name=recipient.display_label,
                merge_fields={
                    "contact.first_name": _first_name(recipient.display_label),
                    "contact.full_name": recipient.display_label,
                    "group.name": recipient.recipient_group.group_name if recipient.recipient_group else "",
                    "recipient.first_name": _first_name(recipient.display_label),
                    "recipient.full_name": recipient.display_label,
                },
            )
            for recipient in recipient_rows
            if recipient.direct_email
        ]
        return _dedupe_recipients(recipients)

    @staticmethod
    def _resolve_member_email(member: CampaignMember) -> str | None:
        if member.email:
            return member.email.strip().lower()
        if member.app_user and member.app_user.email:
            return member.app_user.email.strip().lower()
        return None


def _dedupe_recipients(recipients: list[ResolvedCampaignRecipient]) -> list[ResolvedCampaignRecipient]:
    seen: set[str] = set()
    deduped: list[ResolvedCampaignRecipient] = []
    for recipient in recipients:
        normalized_email = recipient.email.strip().lower()
        if not normalized_email or normalized_email in seen:
            continue
        seen.add(normalized_email)
        deduped.append(recipient)
    return deduped


def _first_name(display_name: str) -> str:
    parts = [part for part in str(display_name).strip().split() if part]
    return parts[0] if parts else display_name
