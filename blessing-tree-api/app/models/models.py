"""
Blessing Tree SQLAlchemy model set (MySQL 8+) matching your DDL exactly.

Key points:
- IDs are BINARY(16) UUIDs.
- Uses MySQL "optimized" UUID byte order compatible with UUID_TO_BIN(uuid, true)
  and BIN_TO_UUID(id, true) via a custom TypeDecorator (UUIDBin).

Works with SQLAlchemy 2.x.
"""

from app.features.rbac.models import CampaignUserRole

from .app_user import AppUser
from .auth import AuthIdentity
from .base import Base
from .campaign import Campaign
from .campaign_communication_schedule import CampaignCommunicationSchedule
from .campaign_event import CampaignEvent
from .campaign_milestone import CampaignMilestone
from .communication_template import CommunicationTemplate
from .donation import Donation
from .donation_line import DonationLine
from .fulfillment import Fulfillment
from .group_contact import GroupContact
from .item_event import ItemEvent
from .label_print_item import LabelPrintItem
from .label_print_job import LabelPrintJob
from .pickup import Pickup
from .pickup_item import PickupItem
from .recipient import Recipient
from .recipient_group import RecipientGroup
from .scan_event import ScanEvent
from .sponsor import Sponsor
from .sponsor_interaction import SponsorInteraction
from .sponsor_reminder import SponsorReminder
from .sponsorship import Sponsorship
from .sponsorship_item import SponsorshipItem
from .storage_location import StorageLocation
from .uuid_bin import UUIDBin
from .wishlist import Wishlist
from .wishlist_item import WishlistItem

__all__ = [
    "AppUser",
    "AuthIdentity",
    "Base",
    "CampaignUserRole",
    "Campaign",
    "CampaignCommunicationSchedule",
    "CampaignEvent",
    "CampaignMilestone",
    "CommunicationTemplate",
    "Donation",
    "DonationLine",
    "Fulfillment",
    "GroupContact",
    "ItemEvent",
    "LabelPrintItem",
    "LabelPrintJob",
    "Pickup",
    "PickupItem",
    "Recipient",
    "RecipientGroup",
    "ScanEvent",
    "Sponsor",
    "SponsorInteraction",
    "SponsorReminder",
    "Sponsorship",
    "SponsorshipItem",
    "StorageLocation",
    "UUIDBin",
    "Wishlist",
    "WishlistItem",
]
