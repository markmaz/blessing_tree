from __future__ import annotations

import argparse
import json
import os
import random
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.features.rbac.constants import (
    ASK_BLESSING_TREE_ROLE,
    CAMPAIGN_MANAGER_ROLE,
    GIFT_OPERATIONS_ROLE,
    PEOPLE_MANAGER_ROLE,
    REPORTS_VIEWER_ROLE,
    SPONSOR_MANAGER_ROLE,
)
from app.models.models import (
    AppUser,
    AuthIdentity,
    Base,
    Campaign,
    CampaignEvent,
    CampaignFlyer,
    CampaignGiftPolicy,
    CampaignGiftTagTemplate,
    CampaignMember,
    CampaignMemberAccessRole,
    CampaignMilestone,
    CampaignTeam,
    CampaignTeamMember,
    CampaignTeamRole,
    CampaignUserRole,
    CommunicationTemplate,
    Donation,
    DonationLine,
    GroupContact,
    OrganizationType,
    PendingSponsorRegistration,
    Recipient,
    RecipientGroup,
    Sponsor,
    SponsorInteraction,
    Sponsorship,
    SponsorshipItem,
    StorageLocation,
    Wishlist,
    WishlistItem,
)
from app.models.campaign_member_constants import APP_ACCESS_STATUS_ACTIVE, CAMPAIGN_MEMBER_TYPE_STAFF
from app.models.communication_audience_constants import COMMUNICATION_AUDIENCE_SPONSOR
from app.models.recipient_constants import (
    GROUP_CONTACT_ROLE_COORDINATOR,
    GROUP_CONTACT_ROLE_GUARDIAN,
    GROUP_CONTACT_ROLE_STAFF,
    PREFERRED_CONTACT_EMAIL,
    PREFERRED_CONTACT_PHONE,
    PREFERRED_CONTACT_TEXT,
    RECIPIENT_AGE_UNIT_MONTHS,
    RECIPIENT_AGE_UNIT_YEARS,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_GROUP_TYPE_ORGANIZATION,
    RECIPIENT_KIND_ADULT,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
    WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
    WISHLIST_STATUS_READY,
)
from app.models.sponsor_constants import (
    PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
    PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED,
    SPONSOR_INTERACTION_ORIGIN_MANUAL,
    SPONSOR_INTERACTION_ORIGIN_PUBLIC_SIGNUP,
    SPONSOR_SOURCE_PUBLIC_LINK,
    SPONSOR_SOURCE_PUBLIC_QR,
    SPONSOR_SOURCE_STAFF_ENTRY,
    SPONSORSHIP_DROP_OFF_STATUS_NOT_STARTED,
    SPONSORSHIP_DROP_OFF_STATUS_SCHEDULED,
    SPONSORSHIP_INTEREST_STATUS_COMMITTED,
    SPONSORSHIP_INTEREST_STATUS_CONTACTED,
    SPONSORSHIP_INTEREST_STATUS_NEW,
    SPONSORSHIP_INTEREST_STATUS_RESPONDED,
    SPONSORSHIP_STATUS_ACTIVE,
)
from app.services.auth.password_service import PasswordService


DEFAULT_CAMPAIGN_NAME = "Blessing Tree Demo 2026"
DEFAULT_CAMPAIGN_SLUG = "blessing-tree-demo-2026"
CAMPAIGN_NAME = DEFAULT_CAMPAIGN_NAME
CAMPAIGN_SLUG = DEFAULT_CAMPAIGN_SLUG
SEED_NAMESPACE = DEFAULT_CAMPAIGN_SLUG
CAMPAIGN_ID = uuid.uuid5(uuid.NAMESPACE_URL, f"{SEED_NAMESPACE}:campaign")
LABEL_CODE_PREFIX = f"BT-DEMO-{str(CAMPAIGN_ID)[:8].upper()}"
DEFAULT_PASSWORD = "DemoPass2026!"

PRESERVED_TABLES = {
    "admin_llm_configuration",
    "app_feature_flag",
    "app_user",
    "app_user_settings",
    "auth_identity",
    "campaign_milestone_definition",
    "campaign_readiness_rule_definition",
}

HOUSTON_STREETS = (
    "Westheimer Rd",
    "Memorial Dr",
    "Kirby Dr",
    "Bellaire Blvd",
    "Bissonnet St",
    "Richmond Ave",
    "Beechnut St",
    "Long Point Rd",
    "Cullen Blvd",
    "Airline Dr",
    "Gessner Rd",
    "Dairy Ashford Rd",
    "Fry Rd",
    "Mason Rd",
    "FM 1960",
)
HOUSTON_CITIES = (
    ("Houston", "77024"),
    ("Houston", "77057"),
    ("Houston", "77081"),
    ("Houston", "77096"),
    ("Bellaire", "77401"),
    ("Pasadena", "77505"),
    ("Pearland", "77584"),
    ("Sugar Land", "77479"),
    ("Katy", "77450"),
    ("Cypress", "77433"),
    ("Spring", "77379"),
    ("Humble", "77346"),
    ("Missouri City", "77459"),
    ("Tomball", "77375"),
)
AREA_CODES = ("713", "281", "832", "346")

FIRST_NAMES_F = (
    "Aaliyah",
    "Abigail",
    "Amelia",
    "Arianna",
    "Ava",
    "Camila",
    "Chloe",
    "Elena",
    "Emma",
    "Grace",
    "Isabella",
    "Jasmine",
    "Layla",
    "Mia",
    "Naomi",
    "Olivia",
    "Riley",
    "Sofia",
    "Victoria",
    "Zoe",
)
FIRST_NAMES_M = (
    "Adrian",
    "Angel",
    "Caleb",
    "Carlos",
    "Daniel",
    "Diego",
    "Elijah",
    "Ethan",
    "Isaac",
    "Jayden",
    "Josiah",
    "Leo",
    "Liam",
    "Mateo",
    "Noah",
    "Owen",
    "Sebastian",
    "Thiago",
    "Xavier",
    "Zion",
)
GUARDIAN_FIRST_NAMES = (
    "Adriana",
    "Aimee",
    "Aisha",
    "Alejandra",
    "Amanda",
    "Amber",
    "Ana",
    "Andrea",
    "Angela",
    "April",
    "Ashley",
    "Bianca",
    "Briana",
    "Brittany",
    "Carla",
    "Carmen",
    "Cassandra",
    "Cecilia",
    "Charity",
    "Christina",
    "Claudia",
    "Crystal",
    "Danielle",
    "Denise",
    "Diana",
    "Ebony",
    "Elena",
    "Erica",
    "Esmeralda",
    "Felicia",
    "Gabriela",
    "Gloria",
    "Grace",
    "Heather",
    "Iris",
    "Jacqueline",
    "Jasmine",
    "Jennifer",
    "Jessica",
    "Joanna",
    "Joy",
    "Karen",
    "Kimberly",
    "Kristen",
    "Laura",
    "Leticia",
    "Linda",
    "Lisa",
    "Marisol",
    "Martha",
    "Melissa",
    "Michelle",
    "Monica",
    "Natalie",
    "Nicole",
    "Patricia",
    "Priscilla",
    "Rachel",
    "Rebecca",
    "Rosa",
    "Sabrina",
    "Sandra",
    "Shannon",
    "Stephanie",
    "Sylvia",
    "Tania",
    "Tiffany",
    "Vanessa",
    "Veronica",
    "Yolanda",
    "Aaron",
    "Abel",
    "Andre",
    "Antonio",
    "Brandon",
    "Carlos",
    "Cedric",
    "Christopher",
    "Daniel",
    "David",
    "Edgar",
    "Eduardo",
    "Eric",
    "Fernando",
    "Gabriel",
    "George",
    "Hector",
    "James",
    "Javier",
    "Jose",
    "Juan",
    "Kevin",
    "Luis",
    "Marcus",
    "Michael",
    "Nathan",
    "Oscar",
    "Ricardo",
    "Robert",
    "Samuel",
    "Stephen",
    "Terrance",
    "Victor",
)
ADULT_FIRST_NAMES = (
    "Alice",
    "Arthur",
    "Beatrice",
    "Betty",
    "Calvin",
    "Carmen",
    "Charles",
    "Delores",
    "Earl",
    "Edna",
    "Frank",
    "Gloria",
    "Harold",
    "Irene",
    "James",
    "Linda",
    "Maria",
    "Martha",
    "Robert",
    "Willie",
)
LAST_NAMES = (
    "Alvarez",
    "Anderson",
    "Armstrong",
    "Bennett",
    "Bishop",
    "Brooks",
    "Brown",
    "Campbell",
    "Carter",
    "Castillo",
    "Chavez",
    "Clark",
    "Coleman",
    "Collins",
    "Cooper",
    "Cruz",
    "Davis",
    "Diaz",
    "Edwards",
    "Ellis",
    "Evans",
    "Flores",
    "Foster",
    "Franklin",
    "Garcia",
    "Gonzalez",
    "Gray",
    "Green",
    "Gutierrez",
    "Hall",
    "Harris",
    "Hernandez",
    "Hill",
    "Howard",
    "Jackson",
    "James",
    "Jenkins",
    "Johnson",
    "Jones",
    "King",
    "Lee",
    "Lewis",
    "Lopez",
    "Maldonado",
    "Martinez",
    "Mitchell",
    "Morales",
    "Morris",
    "Murphy",
    "Nguyen",
    "Ortiz",
    "Parker",
    "Patel",
    "Perez",
    "Phillips",
    "Price",
    "Ramirez",
    "Reed",
    "Rivera",
    "Robinson",
    "Rodriguez",
    "Ross",
    "Salazar",
    "Sanchez",
    "Scott",
    "Smith",
    "Stewart",
    "Taylor",
    "Thompson",
    "Torres",
    "Walker",
    "Washington",
    "White",
    "Williams",
    "Wilson",
    "Wright",
    "Young",
)

KID_GIFTS = {
    "baby": (
        ("Essentials", "ESSENTIAL", "diapers and wipes bundle", "Size 3"),
        ("Essentials", "ESSENTIAL", "diapers and wipes bundle", "Size 4"),
        ("Essentials", "ESSENTIAL", "sensitive-skin wipes case", None),
        ("Toys", "GIFT", "soft stacking blocks", None),
        ("Toys", "GIFT", "silicone teething toy set", None),
        ("Toys", "GIFT", "crinkle cloth book", None),
        ("Toys", "GIFT", "tummy time mirror", None),
        ("Toys", "GIFT", "activity cube with bead maze", None),
        ("Toys", "GIFT", "wooden shape sorter", None),
        ("Toys", "GIFT", "pull-along puppy toy", None),
        ("Toys", "GIFT", "Fisher-Price Little People farm", None),
        ("Clothing", "CLOTHING", "warm pajamas", "12M"),
        ("Clothing", "CLOTHING", "fleece sleep sack", "18M"),
        ("Clothing", "CLOTHING", "onesie multipack", "9M"),
        ("Clothing", "CLOTHING", "soft booties", "Infant 3"),
        ("Essentials", "ESSENTIAL", "baby blanket", None),
        ("Toys", "GIFT", "musical crib toy", None),
        ("Gift Card", "GIFT_CARD", "Target baby essentials gift card", "$25"),
    ),
    "child": (
        ("Toys", "GIFT", "LEGO building set", None),
        ("Toys", "GIFT", "Magna-Tiles starter set", None),
        ("Toys", "GIFT", "Lincoln Logs tin", None),
        ("Toys", "GIFT", "K'NEX building kit", None),
        ("Toys", "GIFT", "Snap Circuits Jr. kit", None),
        ("Toys", "GIFT", "Batman action figure set", None),
        ("Toys", "GIFT", "Spider-Man web blaster", None),
        ("Toys", "GIFT", "Bluey family playhouse", None),
        ("Toys", "GIFT", "Gabby's Dollhouse figure set", None),
        ("Toys", "GIFT", "Pokemon trading card starter box", None),
        ("Toys", "GIFT", "Sonic the Hedgehog plush", None),
        ("Toys", "GIFT", "Minecraft creeper plush", None),
        ("Toys", "GIFT", "Squishmallows mystery plush", None),
        ("Toys", "GIFT", "Hot Wheels 20-car pack", None),
        ("Toys", "GIFT", "Monster Jam truck set", None),
        ("Toys", "GIFT", "Barbie career doll", None),
        ("Toys", "GIFT", "LOL Surprise doll", None),
        ("Toys", "GIFT", "Calico Critters family set", None),
        ("Toys", "GIFT", "Schleich dinosaur figure set", None),
        ("Toys", "GIFT", "Jurassic World dinosaur", None),
        ("Toys", "GIFT", "Mario Kart remote control car", None),
        ("Toys", "GIFT", "remote control stunt car", None),
        ("Toys", "GIFT", "walkie talkie set", None),
        ("Toys", "GIFT", "laser tag set", None),
        ("Toys", "GIFT", "Nerf Elite blaster", None),
        ("Games", "GIFT", "Guess Who board game", None),
        ("Games", "GIFT", "Sorry board game", None),
        ("Games", "GIFT", "Connect 4", None),
        ("Games", "GIFT", "Uno card game bundle", None),
        ("Games", "GIFT", "Exploding Kittens card game", None),
        ("Games", "GIFT", "Ticket to Ride First Journey", None),
        ("Toys", "GIFT", "magic trick kit", None),
        ("Toys", "GIFT", "rock tumbler kit", None),
        ("Toys", "GIFT", "National Geographic geodes kit", None),
        ("Toys", "GIFT", "slime making kit", None),
        ("Toys", "GIFT", "kinetic sand construction set", None),
        ("Toys", "GIFT", "Play-Doh kitchen creations set", None),
        ("Toys", "GIFT", "Lite-Brite classic", None),
        ("Toys", "GIFT", "friendship bracelet maker", None),
        ("Toys", "GIFT", "Perler bead bucket", None),
        ("Toys", "GIFT", "origami animal kit", None),
        ("Toys", "GIFT", "beginner ukulele", None),
        ("Toys", "GIFT", "kids karaoke microphone", None),
        ("Toys", "GIFT", "stomp rocket launcher", None),
        ("Sports", "GIFT", "soccer ball and cones", None),
        ("Sports", "GIFT", "basketball", "Youth"),
        ("Sports", "GIFT", "youth baseball glove", "Youth"),
        ("Sports", "GIFT", "sidewalk chalk and jump rope set", None),
        ("Sports", "GIFT", "scooter", None),
        ("Books", "GIFT", "Dog Man book set", None),
        ("Books", "GIFT", "Diary of a Wimpy Kid box set", None),
        ("Books", "GIFT", "I Survived book set", None),
        ("Books", "GIFT", "Junie B. Jones starter set", None),
        ("Clothing", "CLOTHING", "winter coat", "Youth M"),
        ("Clothing", "CLOTHING", "graphic hoodie", "Youth L"),
        ("Clothing", "CLOTHING", "jeans", "Youth 8"),
        ("Clothing", "CLOTHING", "sneakers", "Youth 3"),
        ("Clothing", "CLOTHING", "character pajamas", "Youth S"),
        ("Essentials", "ESSENTIAL", "school backpack", None),
        ("Essentials", "ESSENTIAL", "water bottle and lunch box set", None),
        ("Toys", "GIFT", "art supplies kit", None),
        ("Electronics", "GIFT", "kids headphones", None),
        ("Electronics", "GIFT", "digital drawing pad", None),
        ("Gift Card", "GIFT_CARD", "Target gift card", "$25"),
        ("Gift Card", "GIFT_CARD", "Five Below gift card", "$20"),
    ),
    "teen": (
        ("Electronics", "GIFT", "wireless earbuds", None),
        ("Electronics", "GIFT", "Bluetooth speaker", None),
        ("Electronics", "GIFT", "portable phone charger", None),
        ("Electronics", "GIFT", "LED strip lights", None),
        ("Electronics", "GIFT", "gaming headset", None),
        ("Electronics", "GIFT", "phone tripod with ring light", None),
        ("Gift Card", "GIFT_CARD", "Amazon gift card", "$30"),
        ("Gift Card", "GIFT_CARD", "Target gift card", "$30"),
        ("Gift Card", "GIFT_CARD", "Starbucks gift card", "$20"),
        ("Gift Card", "GIFT_CARD", "Chick-fil-A gift card", "$20"),
        ("Gift Card", "GIFT_CARD", "Roblox gift card", "$25"),
        ("Gift Card", "GIFT_CARD", "PlayStation Store gift card", "$25"),
        ("Gift Card", "GIFT_CARD", "Xbox gift card", "$25"),
        ("Clothing", "CLOTHING", "hoodie", "Adult M"),
        ("Clothing", "CLOTHING", "oversized sweatshirt", "Adult S"),
        ("Clothing", "CLOTHING", "joggers", "Adult M"),
        ("Clothing", "CLOTHING", "beanie and gloves set", None),
        ("Essentials", "ESSENTIAL", "hygiene basket", None),
        ("Essentials", "ESSENTIAL", "duffel bag", None),
        ("Essentials", "ESSENTIAL", "school supply and planner bundle", None),
        ("Sports", "GIFT", "basketball and pump", None),
        ("Sports", "GIFT", "soccer ball", "Size 5"),
        ("Sports", "GIFT", "skateboard", None),
        ("Sports", "GIFT", "pickleball paddle set", None),
        ("Sports", "GIFT", "resistance band workout kit", None),
        ("Games", "GIFT", "Nintendo Switch game", None),
        ("Games", "GIFT", "Mario Kart 8 Deluxe", None),
        ("Games", "GIFT", "Minecraft for Nintendo Switch", None),
        ("Games", "GIFT", "Madden NFL video game", None),
        ("Games", "GIFT", "Just Dance video game", None),
        ("Games", "GIFT", "Catan board game", None),
        ("Games", "GIFT", "Taco Cat Goat Cheese Pizza card game", None),
        ("Games", "GIFT", "Dungeons & Dragons starter set", None),
        ("Games", "GIFT", "chess clock and tournament board", None),
        ("Clothing", "CLOTHING", "athletic shoes", "Adult 9"),
        ("Clothing", "CLOTHING", "Converse-style sneakers", "Adult 8"),
        ("Beauty", "GIFT", "skin care gift set", None),
        ("Beauty", "GIFT", "curl care hair products", None),
        ("Beauty", "GIFT", "nail polish and manicure kit", None),
        ("Beauty", "GIFT", "makeup brush set", None),
        ("Music", "GIFT", "beginner acoustic guitar", None),
        ("Music", "GIFT", "vinyl record storage crate", None),
        ("Art", "GIFT", "sketchbook and alcohol markers", None),
        ("Art", "GIFT", "acrylic paint set", None),
        ("Books", "GIFT", "manga starter box set", None),
        ("Books", "GIFT", "fantasy novel trilogy", None),
        ("Hobbies", "GIFT", "mechanical keyboard kit", None),
        ("Hobbies", "GIFT", "model car kit", None),
        ("Hobbies", "GIFT", "crochet starter kit", None),
        ("Hobbies", "GIFT", "locksport practice lock set", None),
        ("Hobbies", "GIFT", "speed cube and timer", None),
    ),
}
ADULT_GIFTS = (
    ("Comfort", "GIFT", "soft throw blanket", None),
    ("Comfort", "GIFT", "non-slip slippers", "L"),
    ("Personal Care", "ESSENTIAL", "lotion and hand cream set", None),
    ("Activities", "GIFT", "large-print puzzle book", None),
    ("Gift Card", "GIFT_CARD", "Walmart gift card", "$25"),
    ("Clothing", "CLOTHING", "warm cardigan", "XL"),
    ("Comfort", "GIFT", "lap blanket", None),
    ("Activities", "GIFT", "bird feeder for window", None),
)

SPONSOR_FIRST_NAMES = (
    "Aaron",
    "Alicia",
    "Angela",
    "Anthony",
    "Ashley",
    "Barbara",
    "Ben",
    "Brenda",
    "Brian",
    "Calvin",
    "Catherine",
    "Chris",
    "Cynthia",
    "Courtney",
    "Daniel",
    "David",
    "Denise",
    "Eileen",
    "Eric",
    "Erin",
    "Felicia",
    "Greg",
    "Hannah",
    "Heather",
    "Ivan",
    "Jason",
    "Jennifer",
    "Jo",
    "Jordan",
    "Julia",
    "Karen",
    "Keith",
    "Laura",
    "Lauren",
    "Manuel",
    "Marcus",
    "Maria",
    "Marvin",
    "Monica",
    "Natalie",
    "Oscar",
    "Rachel",
    "Renee",
    "Roberto",
    "Samuel",
    "Sharon",
    "Sonia",
    "Tanya",
    "Victoria",
    "Wendy",
)
SPONSOR_ORGS = (
    "Memorial Office Group",
    "West Houston Moms Club",
    "Katy Small Group",
    "River Oaks Book Club",
    "Energy Corridor Team",
    "Pearland Dental Partners",
    "Cypress Teachers Circle",
    "Bellaire Rotary Friends",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Blessing Tree Demo 2026 campaign.")
    parser.add_argument("--reset", action="store_true", help="Clear operational data before seeding.")
    parser.add_argument("--yes", action="store_true", help="Required with --reset to confirm destructive local reset.")
    parser.add_argument(
        "--allow-production-replace",
        action="store_true",
        help="Allow replacing an existing seeded campaign when CURRENT_ENVIRONMENT=production. Does not allow --reset.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Create the seeded campaign without deleting or replacing existing seeded data.",
    )
    parser.add_argument("--campaign-name", default=DEFAULT_CAMPAIGN_NAME, help="Name for the seeded campaign.")
    parser.add_argument(
        "--campaign-slug",
        default=None,
        help="Public sponsor slug and deterministic seed namespace. Defaults to a slugified campaign name.",
    )
    args = parser.parse_args()
    if args.reset and not args.yes:
        raise SystemExit("Refusing to reset without --yes.")
    if args.reset and args.append:
        raise SystemExit("--reset and --append cannot be used together.")
    enforce_environment_safety(
        reset=args.reset,
        append=args.append,
        allow_production_replace=args.allow_production_replace,
    )

    configure_seed_context(
        campaign_name=args.campaign_name,
        campaign_slug=args.campaign_slug or slugify(args.campaign_name),
    )

    with SessionLocal() as db:
        if args.reset:
            reset_operational_data(db)
        elif args.append:
            ensure_seed_campaign_absent(db)
        else:
            refresh_seeded_campaign_only(db)
        summary = seed_demo(db)
        db.commit()
    print_summary(summary)


def enforce_environment_safety(*, reset: bool, append: bool, allow_production_replace: bool) -> None:
    current_environment = os.getenv("CURRENT_ENVIRONMENT", "development").strip().lower()
    if current_environment != "production":
        return
    if reset:
        raise SystemExit("Refusing to run --reset when CURRENT_ENVIRONMENT=production.")
    if not append and not allow_production_replace:
        raise SystemExit(
            "Refusing to replace seeded campaign data in production. Use --append with a unique "
            "campaign name/slug, or pass --allow-production-replace intentionally."
        )


def configure_seed_context(*, campaign_name: str, campaign_slug: str) -> None:
    global CAMPAIGN_NAME, CAMPAIGN_SLUG, SEED_NAMESPACE, CAMPAIGN_ID, LABEL_CODE_PREFIX
    CAMPAIGN_NAME = campaign_name.strip()
    CAMPAIGN_SLUG = campaign_slug.strip()
    if not CAMPAIGN_NAME:
        raise SystemExit("Campaign name cannot be empty.")
    if not CAMPAIGN_SLUG:
        raise SystemExit("Campaign slug cannot be empty.")
    SEED_NAMESPACE = CAMPAIGN_SLUG
    CAMPAIGN_ID = uuid.uuid5(uuid.NAMESPACE_URL, f"{SEED_NAMESPACE}:campaign")
    LABEL_CODE_PREFIX = f"BT-DEMO-{str(CAMPAIGN_ID)[:8].upper()}"


def slugify(value: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    parts = [part for part in slug.split("-") if part]
    return "-".join(parts)


def reset_operational_data(db: Session) -> None:
    conn = db.connection()
    conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in PRESERVED_TABLES:
            continue
        conn.execute(table.delete())
    conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    db.flush()


def refresh_seeded_campaign_only(db: Session) -> None:
    campaigns = (
        db.query(Campaign)
        .filter(
            or_(
                Campaign.id == CAMPAIGN_ID,
                Campaign.name == CAMPAIGN_NAME,
                Campaign.public_sponsor_slug == CAMPAIGN_SLUG,
            )
        )
        .all()
    )
    for campaign in campaigns:
        db.delete(campaign)
    db.flush()

    demo_sponsor_ids = [demo_uuid(f"sponsor:{index}") for index in range(1, 93)]
    db.query(Sponsor).filter(Sponsor.id.in_(demo_sponsor_ids)).delete(synchronize_session=False)
    db.flush()


def ensure_seed_campaign_absent(db: Session) -> None:
    existing = (
        db.query(Campaign)
        .filter(
            or_(
                Campaign.id == CAMPAIGN_ID,
                Campaign.name == CAMPAIGN_NAME,
                Campaign.public_sponsor_slug == CAMPAIGN_SLUG,
            )
        )
        .first()
    )
    if existing is not None:
        raise SystemExit(
            "Refusing to append because a campaign already exists with the requested "
            f"name, slug, or deterministic id: {existing.name}"
        )


def seed_demo(db: Session) -> dict[str, int]:
    rng = random.Random(20260604)
    users = seed_users(db)
    seed_organization_types(db)
    campaign = seed_campaign(db)
    seed_user_access(db, campaign, users)
    seed_campaign_setup(db, campaign, users["manager"].id)
    orgs = seed_organizations(db, campaign)
    children, adult_recipients, wishlist_items = seed_recipients_and_wishlists(db, campaign, orgs, rng)
    family_id_summary = validate_demo_family_ids(db, campaign, orgs["blessing_tree"].id)
    gift_pool_lines = seed_gift_pool_inventory(db, campaign, users["gift_ops"].id)
    sponsors, sponsorships = seed_sponsors(db, campaign, users["sponsor_intake"].id, rng)
    committed_count = seed_commitments(db, wishlist_items, sponsorships, rng)
    seed_sponsor_interactions(db, campaign, sponsors, sponsorships, users["sponsor_intake"].id, rng)
    return {
        "campaigns": 1,
        "demo_users": len(users),
        "organizations": len(orgs),
        "families": family_id_summary["families"],
        "foster_children": int(getattr(campaign, "_demo_foster_child_count", 0)),
        "children": len(children),
        "nursing_home_adults": len(adult_recipients),
        "wishlist_items": len(wishlist_items),
        "gift_pool_lines": gift_pool_lines,
        "sponsors": len(sponsors),
        "committed_gifts": committed_count,
    }


def validate_demo_family_ids(db: Session, campaign: Campaign, blessing_tree_group_id: uuid.UUID) -> dict[str, int]:
    family_groups = (
        db.query(RecipientGroup)
        .filter(
            RecipientGroup.campaign_id == campaign.id,
            RecipientGroup.parent_organization_group_id == blessing_tree_group_id,
            RecipientGroup.group_type == RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        )
        .order_by(RecipientGroup.program_group_number.asc())
        .all()
    )
    family_ids = [family.program_group_id for family in family_groups]
    validate_seed_family_id_values(family_ids)

    recipients = (
        db.query(Recipient)
        .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
        .filter(
            Recipient.campaign_id == campaign.id,
            RecipientGroup.parent_organization_group_id == blessing_tree_group_id,
            Recipient.program_type == RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        )
        .all()
    )
    recipient_ids = [recipient.program_recipient_id for recipient in recipients]
    validate_seed_recipient_id_values(recipient_ids, set(family_ids))
    return {"families": len(family_ids), "children": len(recipient_ids)}


def validate_seed_family_id_values(family_ids: list[str | None]) -> None:
    expected_ids = [f"BT-{index:03d}" for index in range(1, 101)]
    actual_ids = sorted(str(family_id) for family_id in family_ids if family_id)
    if actual_ids != expected_ids:
        raise RuntimeError("Seeded Blessing Tree family IDs must be BT-001 through BT-100.")
    if len(set(actual_ids)) != len(actual_ids):
        raise RuntimeError("Seeded Blessing Tree family IDs contain duplicates.")


def validate_seed_recipient_id_values(recipient_ids: list[str | None], family_ids: set[str | None]) -> None:
    actual_ids = [str(recipient_id) for recipient_id in recipient_ids if recipient_id]
    if len(actual_ids) != len(recipient_ids):
        raise RuntimeError("Every seeded Blessing Tree child must have a recipient ID.")
    if len(set(actual_ids)) != len(actual_ids):
        raise RuntimeError("Seeded Blessing Tree child recipient IDs contain duplicates.")
    family_prefixes = {str(family_id) for family_id in family_ids if family_id}
    for recipient_id in actual_ids:
        family_id = recipient_id.rsplit("-", 1)[0]
        suffix = recipient_id.rsplit("-", 1)[-1]
        if family_id not in family_prefixes or not suffix.isdigit() or len(suffix) < 2:
            raise RuntimeError(f"Seeded child recipient ID {recipient_id} does not match the family ID scheme.")


def seed_users(db: Session) -> dict[str, AppUser]:
    password_hash = PasswordService().hash_password(DEFAULT_PASSWORD)
    specs = {
        "manager": ("demo.manager@blessingtree.local", "Demo Campaign Manager", "ADMIN"),
        "people_intake": ("demo.people@blessingtree.local", "Demo People Intake", "COORDINATOR"),
        "sponsor_intake": ("demo.sponsors@blessingtree.local", "Demo Sponsor Intake", "COORDINATOR"),
        "gift_ops": ("demo.gifts@blessingtree.local", "Demo Gift Operations", "COORDINATOR"),
        "reports": ("demo.reports@blessingtree.local", "Demo Reports Viewer", "COORDINATOR"),
    }
    users: dict[str, AppUser] = {}
    for key, (email, name, role) in specs.items():
        user = db.query(AppUser).filter(AppUser.email == email).one_or_none()
        if user is None:
            user = AppUser(id=demo_uuid(f"user:{key}"), email=email, display_name=name, role=role, is_active=True)
            db.add(user)
            db.flush()
        else:
            user.display_name = name
            user.role = role
            user.is_active = True
        identity = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.provider == "LOCAL", AuthIdentity.email == email)
            .one_or_none()
        )
        if identity is None:
            db.add(
                AuthIdentity(
                    id=demo_uuid(f"auth:{key}"),
                    user_id=user.id,
                    provider="LOCAL",
                    provider_sub=None,
                    email=email,
                    password_hash=password_hash,
                    is_active=True,
                )
            )
        else:
            identity.user_id = user.id
            identity.password_hash = password_hash
            identity.is_active = True
        users[key] = user
    db.flush()
    return users


def seed_organization_types(db: Session) -> None:
    for index, (code, label, category) in enumerate(
        (
            ("NURSING_HOME", "Nursing Home", RECIPIENT_KIND_ADULT),
            ("FOSTER_CARE", "Foster Care", "FAMILY"),
            ("CHURCH_PROGRAM", "Church Program", "FAMILY"),
        ),
        start=1,
    ):
        organization_type = db.query(OrganizationType).filter(OrganizationType.code == code).one_or_none()
        if organization_type is None:
            organization_type = OrganizationType(
                id=demo_uuid(f"organization-type:{code}"),
                code=code,
            )
            db.add(organization_type)
        organization_type.label = label
        organization_type.recipient_category = category
        organization_type.is_active = True
        organization_type.sort_order = index * 10


def seed_campaign(db: Session) -> Campaign:
    campaign = Campaign(
        id=CAMPAIGN_ID,
        name=CAMPAIGN_NAME,
        description=(
            "Realistic demo campaign for walking staff through sponsor signup, people intake, gift search, "
            "gift commitments, reports, and print workflows."
        ),
        season_theme="Giving and Love",
        public_sponsor_slug=CAMPAIGN_SLUG,
        public_sponsor_signup_enabled=True,
        year=2026,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 12, 31),
        status="ACTIVE",
    )
    db.add(campaign)
    db.flush()
    return campaign


def seed_user_access(db: Session, campaign: Campaign, users: dict[str, AppUser]) -> None:
    assignments = {
        "manager": (CAMPAIGN_MANAGER_ROLE,),
        "people_intake": (PEOPLE_MANAGER_ROLE, ASK_BLESSING_TREE_ROLE),
        "sponsor_intake": (SPONSOR_MANAGER_ROLE, ASK_BLESSING_TREE_ROLE),
        "gift_ops": (GIFT_OPERATIONS_ROLE, ASK_BLESSING_TREE_ROLE),
        "reports": (REPORTS_VIEWER_ROLE, ASK_BLESSING_TREE_ROLE),
    }
    for key, role_keys in assignments.items():
        user = users[key]
        member = CampaignMember(
            id=demo_uuid(f"campaign-member:user:{key}"),
            campaign_id=campaign.id,
            display_name=user.display_name,
            email=user.email,
            phone=phone_for_index(900 + len(key)),
            member_type=CAMPAIGN_MEMBER_TYPE_STAFF,
            app_user_id=user.id,
            app_access_status=APP_ACCESS_STATUS_ACTIVE,
            is_active=True,
        )
        db.add(member)
        for role_key in role_keys:
            db.add(
                CampaignUserRole(
                    id=demo_uuid(f"campaign-user-role:{key}:{role_key}"),
                    campaign_id=campaign.id,
                    user_id=user.id,
                    role_key=role_key,
                    is_active=True,
                )
            )
            db.add(
                CampaignMemberAccessRole(
                    id=demo_uuid(f"campaign-member-role:{key}:{role_key}"),
                    campaign_member_id=member.id,
                    role_key=role_key,
                    is_active=True,
                )
            )
    db.flush()


def seed_campaign_setup(db: Session, campaign: Campaign, manager_user_id: uuid.UUID) -> None:
    for index, (code, name, notes) in enumerate(
        (
            ("DROP", "Gift Drop-Off", "Main intake tables at the demo warehouse."),
            ("WRAP", "Wrapping Room", "Use during wrapping walkthroughs."),
            ("READY", "Ready Shelves", "Final staged gifts before pickup or distribution."),
        ),
        start=1,
    ):
        db.add(
            StorageLocation(
                id=demo_uuid(f"storage:{code}"),
                campaign_id=campaign.id,
                code=code,
                name=name,
                notes=notes,
                is_active=True,
            )
        )
    milestones = (
        ("registration_open", "Registration Opens", date(2026, 10, 1)),
        ("registration_close", "Registration Closes", date(2026, 11, 6)),
        ("sponsor_registration_start", "Sponsor Registration Starts", date(2026, 11, 1)),
        ("sponsor_registration_end", "Sponsor Registration Ends", date(2026, 12, 12)),
        ("sponsor_outreach_start", "Sponsor Outreach Starts", date(2026, 11, 3)),
        ("gift_intake_start", "Gift Intake Starts", date(2026, 12, 1)),
        ("gift_intake_end", "Gift Intake Ends", date(2026, 12, 18)),
        ("gift_turn_in_due", "Gift Turn-In Due", date(2026, 12, 18)),
        ("pickup_start", "Pickup Window Opens", date(2026, 12, 20)),
        ("pickup_end", "Pickup Window Closes", date(2026, 12, 22)),
        ("campaign_close", "Campaign Closes", date(2026, 12, 31)),
    )
    for index, (key, label, occurs_on) in enumerate(milestones, start=1):
        db.add(
            CampaignMilestone(
                id=demo_uuid(f"milestone:{key}"),
                campaign_id=campaign.id,
                milestone_key=key,
                label=label,
                occurs_on=occurs_on,
                notes=f"Demo {label.lower()} date.",
                sort_order=index * 10,
            )
        )
        db.add(
            CampaignEvent(
                id=demo_uuid(f"event:milestone:{key}"),
                campaign_id=campaign.id,
                title=label,
                event_type="MILESTONE",
                start_at=datetime.combine(occurs_on, datetime.min.time()).replace(hour=9),
                end_at=None,
                all_day=True,
                notes=f"Generated from demo milestone {key}.",
                source_type="milestone",
                source_id=demo_uuid(f"milestone:{key}"),
                created_by_user_id=manager_user_id,
            )
        )
    events = (
        ("Sponsor Phone Bank", "SPONSOR", datetime(2026, 11, 7, 18), datetime(2026, 11, 7, 20)),
        ("People Intake Quality Review", "RECIPIENT", datetime(2026, 11, 10, 10), datetime(2026, 11, 10, 12)),
        ("Gift Drop-Off Day", "GIFT", datetime(2026, 12, 13, 9), datetime(2026, 12, 13, 15)),
        ("Wrapping Night", "VOLUNTEER", datetime(2026, 12, 17, 18), datetime(2026, 12, 17, 21)),
    )
    for index, (title, event_type, start_at, end_at) in enumerate(events, start=1):
        db.add(
            CampaignEvent(
                id=demo_uuid(f"event:manual:{index}"),
                campaign_id=campaign.id,
                title=title,
                event_type=event_type,
                start_at=start_at,
                end_at=end_at,
                all_day=False,
                notes="Demo operational event.",
                source_type="manual",
                created_by_user_id=manager_user_id,
            )
        )
    seed_templates(db, campaign, manager_user_id)
    seed_teams(db, campaign)
    seed_gift_policy_and_design(db, campaign, manager_user_id)


def seed_templates(db: Session, campaign: Campaign, manager_user_id: uuid.UUID) -> None:
    gift_summary_body = sponsor_qr_email_body(
        "Your Blessing Tree gift commitments",
        (
            "Hi {{sponsor.first_name}},\n\n"
            "Thank you for supporting {{campaign.name}}. Here are the gifts currently assigned to you:\n\n"
            "{{gift.all_list}}\n\n"
            "Recipient IDs for drop-off check-in: {{gift.dropoff_recipient_ids}}"
        ),
        (
            "Keep this QR code with you when you shop and when you drop off gifts. "
            "Staff can scan it to open your committed gift list."
        ),
        "If anything changes, reply to this message so our sponsor team can help.",
    )
    dropoff_body = sponsor_qr_email_body(
        "Gift drop-off reminder",
        (
            "Hi {{sponsor.first_name}},\n\n"
            "This is a reminder that gifts are due by {{gift.due_date}}.\n\n"
            "{{gift.awaiting_turn_in_list}}\n\n"
            "Recipient IDs for check-in: {{gift.dropoff_recipient_ids}}"
        ),
        "Staff can scan this QR code at drop-off to open your gift list.",
        "Please label each gift with the recipient ID if possible.",
    )
    final_reminder_body = sponsor_qr_email_body(
        "Final sponsor reminder",
        (
            "Hi {{sponsor.first_name}},\n\n"
            "This is the final reminder for your {{campaign.name}} commitments. "
            "Please bring remaining gifts by {{gift.due_date}} or contact us right away.\n\n"
            "{{gift.awaiting_turn_in_list}}\n\n"
            "Recipient IDs for drop-off check-in: {{gift.dropoff_recipient_ids}}"
        ),
        "Bring this QR code with your gifts so staff can quickly confirm your drop-off.",
        "Thank you for helping make the Giving and Love campaign possible.",
    )
    templates = (
        (
            "sponsor_gift_summary",
            "Sponsor Gift Summary",
            "Your {{campaign.name}} gift commitments",
            gift_summary_body,
        ),
        (
            "sponsor_drop_off_reminder",
            "Sponsor Gift Drop-Off Reminder",
            "Gift drop-off reminder for {{campaign.name}}",
            dropoff_body,
        ),
        (
            "final_sponsor_reminder",
            "Final Sponsor Reminder",
            "Final reminder: {{campaign.name}} gifts are due soon",
            final_reminder_body,
        ),
        (
            "sponsor_thank_you",
            "Sponsor Thank You",
            "Thank you from {{campaign.name}}",
            "Hi {{sponsor.first_name}},\n\nThank you for supporting {{campaign.name}}. Your generosity helps families and adults across Greater Houston feel seen and cared for.",
        ),
    )
    for index, (key, name, subject, body) in enumerate(templates, start=1):
        db.add(
            CommunicationTemplate(
                id=demo_uuid(f"template:{key}"),
                campaign_id=campaign.id,
                template_key=key,
                name=name,
                audience=COMMUNICATION_AUDIENCE_SPONSOR,
                channel="EMAIL",
                subject_template=subject,
                body_template=body,
                is_active=True,
                created_by_user_id=manager_user_id,
            )
        )


def sponsor_qr_email_body(heading: str, main_content: str, qr_caption: str, closing_content: str) -> str:
    return "__bt_template_blocks_v1__::" + json.dumps(
        {
            "version": 1,
            "blocks": [
                {
                    "id": "sponsor-qr-heading",
                    "type": "heading",
                    "content": heading,
                },
                {
                    "id": "sponsor-qr-main",
                    "type": "text",
                    "content": main_content,
                },
                {
                    "id": "sponsor-qr-image",
                    "type": "image",
                    "src": "{{gift.dropoff_qr_image}}",
                    "altText": "Sponsor drop-off QR code",
                    "caption": qr_caption,
                },
                {
                    "id": "sponsor-qr-location",
                    "type": "text",
                    "content": (
                        "Drop-off location:\n"
                        "Blessing Tree Demo Warehouse\n"
                        "1212 Giving Ln\n"
                        "Houston, TX 77024\n"
                        "Map: https://maps.example.com/blessing-tree-demo-warehouse\n\n"
                        "Plain link fallback: {{gift.dropoff_qr_url}}\n\n"
                        f"{closing_content}"
                    ),
                },
            ],
        },
        separators=(",", ":"),
    )


def seed_teams(db: Session, campaign: Campaign) -> None:
    member_specs = {
        "manager_2": ("Maya Campaign Co-Lead", "maya.colead@blessingtree.local", "7135554101"),
        "people_2": ("Ana People Intake", "ana.people@blessingtree.local", "7135554102"),
        "people_3": ("Luis Intake Reviewer", "luis.people@blessingtree.local", "7135554103"),
        "sponsor_2": ("Nora Sponsor Caller", "nora.sponsors@blessingtree.local", "7135554104"),
        "sponsor_3": ("Victor Sponsor Follow-Up", "victor.sponsors@blessingtree.local", "7135554105"),
        "it_2": ("Priya IT Support", "priya.it@blessingtree.local", "7135554106"),
    }
    member_by_key: dict[str, CampaignMember] = {}
    for key, (name, email, phone) in member_specs.items():
        member = CampaignMember(
            id=demo_uuid(f"campaign-member:{key}"),
            campaign_id=campaign.id,
            display_name=name,
            email=email,
            phone=phone,
            member_type=CAMPAIGN_MEMBER_TYPE_STAFF,
            app_access_status="none",
            is_active=True,
        )
        db.add(member)
        member_by_key[key] = member
    db.flush()

    team_specs = {
        "campaign_managers": (
            "Campaign Managers",
            "Full campaign ownership and decision making.",
            ("campaign.manager", "manager_2"),
        ),
        "people_intake": ("People Intake Team", "Family, organization, and wishlist entry.", ("people.intake", "people_2", "people_3")),
        "sponsor_intake": ("Sponsor Intake Team", "Sponsor signup, calling, and follow-up.", ("sponsor.intake", "sponsor_2", "sponsor_3")),
        "it": ("IT Group", "Technical support, printing, and QR troubleshooting.", ("gift.ops", "it_2")),
    }
    member_by_key["campaign.manager"] = db.query(CampaignMember).filter(CampaignMember.email == "demo.manager@blessingtree.local").one()
    member_by_key["people.intake"] = db.query(CampaignMember).filter(CampaignMember.email == "demo.people@blessingtree.local").one()
    member_by_key["sponsor.intake"] = db.query(CampaignMember).filter(CampaignMember.email == "demo.sponsors@blessingtree.local").one()
    member_by_key["gift.ops"] = db.query(CampaignMember).filter(CampaignMember.email == "demo.gifts@blessingtree.local").one()

    for index, (key, (name, description, member_keys)) in enumerate(team_specs.items(), start=1):
        team = CampaignTeam(
            id=demo_uuid(f"team:{key}"),
            campaign_id=campaign.id,
            name=name,
            description=description,
            is_active=True,
        )
        db.add(team)
        role = CampaignTeamRole(
            id=demo_uuid(f"team-role:{key}:lead"),
            team_id=team.id,
            name="Lead" if key == "campaign_managers" else "Member",
            description=f"{name} demo role.",
            sort_order=index * 10,
            is_active=True,
        )
        db.add(role)
        for member_key in member_keys:
            member = member_by_key[member_key]
            db.add(
                CampaignTeamMember(
                    id=demo_uuid(f"team-member:{key}:{member.id}"),
                    team_id=team.id,
                    campaign_member_id=member.id,
                    team_role_id=role.id,
                )
            )


def seed_gift_policy_and_design(db: Session, campaign: Campaign, manager_user_id: uuid.UUID) -> None:
    db.add(
        CampaignGiftPolicy(
            id=demo_uuid("gift-policy"),
            campaign_id=campaign.id,
            max_gifts_per_sponsor=5,
            max_wishlist_items_per_recipient=5,
            recipient_coverage_rule="MIN_GIFTS_SPONSORED",
            recipient_coverage_required_count=2,
            allow_partial_sponsor_commitments=False,
            reservation_hold_minutes=1440,
        )
    )
    db.add(
        CampaignGiftTagTemplate(
            id=demo_uuid("gift-tag-template"),
            campaign_id=campaign.id,
            template_key="demo_default",
            name="Giving and Love Demo Tag",
            tag_width_in=Decimal("3.00"),
            tag_height_in=Decimal("2.00"),
            orientation="LANDSCAPE",
            layout_json={
                "version": 1,
                "elements": [
                    {"type": "text", "text": "{{recipient.id}}", "x": 0.15, "y": 0.15, "size": 16},
                    {"type": "text", "text": "{{gift.description}}", "x": 0.15, "y": 0.55, "size": 10},
                    {"type": "qr", "x": 2.15, "y": 0.25, "size": 0.65},
                ],
            },
            gift_tag_message="Giving and Love",
            include_cut_lines_default=True,
            is_active=True,
            created_by_user_id=manager_user_id,
        )
    )
    db.add(
        CampaignFlyer(
            id=demo_uuid("sponsor-flyer"),
            campaign_id=campaign.id,
            flyer_key="demo_sponsor_recruitment",
            name="Giving and Love Sponsor Flyer",
            flyer_type="SPONSOR_RECRUITMENT",
            headline="Blessing Tree Demo 2026",
            subheadline="Giving and Love across Greater Houston",
            body_text="Choose a gift, shop with care, and bring it to the Blessing Tree Demo Warehouse by the due date.",
            call_to_action="Scan to sponsor a gift",
            contact_info="demo.sponsors@blessingtree.local",
            qr_target_type="PUBLIC_SPONSOR_SIGNUP",
            theme_mode="CAMPAIGN_PURPOSE",
            image_prompt="warm holiday giving table with wrapped gifts",
            layout_json={"version": 1, "template": "demo"},
            is_active=True,
            created_by_user_id=manager_user_id,
        )
    )


def seed_organizations(db: Session, campaign: Campaign) -> dict[str, RecipientGroup]:
    specs = {
        "oakmont": ("Oakmont", "NURSING_HOME", "OAK", "4100 Memorial Dr", "Houston", "77007"),
        "azelway": ("Azelway", "NURSING_HOME", "AZ", "9300 Westheimer Rd", "Houston", "77063"),
        "blessing_tree": ("Blessing Tree", "CHURCH_PROGRAM", "BT", "1212 Giving Ln", "Houston", "77024"),
        "foster_care": ("Houston Foster Care Network", "FOSTER_CARE", "FC", "5400 Bellaire Blvd", "Bellaire", "77401"),
    }
    orgs: dict[str, RecipientGroup] = {}
    for key, (name, org_type, abbrev, address, city, postal) in specs.items():
        group = RecipientGroup(
            id=demo_uuid(f"org:{key}"),
            campaign_id=campaign.id,
            group_type=RECIPIENT_GROUP_TYPE_ORGANIZATION,
            group_name=name,
            organization_type=org_type,
            program_abbreviation=abbrev,
            intake_source="Demo seed",
            notes=f"{name} demo organization.",
            status=RECIPIENT_GROUP_STATUS_ACTIVE,
            address_line1=address,
            city=city,
            state="TX",
            postal_code=postal,
        )
        db.add(group)
        orgs[key] = group
        db.add(
            GroupContact(
                id=demo_uuid(f"org-contact:{key}"),
                recipient_group_id=group.id,
                contact_role=GROUP_CONTACT_ROLE_COORDINATOR if key != "oakmont" and key != "azelway" else GROUP_CONTACT_ROLE_STAFF,
                relationship_label="Program Coordinator",
                first_name={"oakmont": "Janet", "azelway": "Melissa", "blessing_tree": "Rebecca", "foster_care": "Tanya"}[key],
                last_name={"oakmont": "Parker", "azelway": "Collins", "blessing_tree": "Moore", "foster_care": "Brooks"}[key],
                email=f"{key.replace('_', '.')}@bt-demo.local",
                phone=phone_for_index(100 + len(orgs)),
                preferred_contact=PREFERRED_CONTACT_EMAIL,
                is_primary=True,
                can_pick_up=True,
                is_emergency_contact=True,
            )
        )
    db.flush()
    return orgs


def seed_recipients_and_wishlists(
    db: Session,
    campaign: Campaign,
    orgs: dict[str, RecipientGroup],
    rng: random.Random,
) -> tuple[list[Recipient], list[Recipient], list[WishlistItem]]:
    all_items: list[WishlistItem] = []
    children: list[Recipient] = []
    adults: list[Recipient] = []
    child_counter = 0
    item_counter = 0
    family_child_counts = [2] * 64 + [3] * 26 + [4] * 6 + [5] * 4
    rng.shuffle(family_child_counts)
    guardian_names = unique_guardian_names(rng, len(family_child_counts))
    for family_index, child_count in enumerate(family_child_counts, start=1):
        first_name, last_name = guardian_names[family_index - 1]
        address_line1, city, postal = address_for_index(family_index)
        family = RecipientGroup(
            id=demo_uuid(f"family:{family_index}"),
            campaign_id=campaign.id,
            parent_organization_group_id=orgs["blessing_tree"].id,
            group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
            group_name=f"{first_name} {last_name} Family",
            organization_type=None,
            program_abbreviation=None,
            program_group_number=family_index,
            program_group_id=f"BT-{family_index:03d}",
            intake_source="Blessing Tree intake",
            notes=rng.choice(("Needs evening pickup window.", "Prefers text reminders.", "Referred by church partner.", None)),
            status=RECIPIENT_GROUP_STATUS_ACTIVE,
            address_line1=address_line1,
            city=city,
            state="TX",
            postal_code=postal,
        )
        db.add(family)
        db.add(
            GroupContact(
                id=demo_uuid(f"family-contact:{family_index}"),
                recipient_group_id=family.id,
                contact_role=GROUP_CONTACT_ROLE_GUARDIAN,
                relationship_label=rng.choice(("Parent", "Guardian", "Grandparent")),
                first_name=first_name,
                last_name=last_name,
                email=f"{first_name.lower()}.{last_name.lower()}{family_index}@example.test",
                phone=phone_for_index(family_index),
                preferred_contact=rng.choice((PREFERRED_CONTACT_TEXT, PREFERRED_CONTACT_PHONE, PREFERRED_CONTACT_EMAIL)),
                is_primary=True,
                can_pick_up=True,
                is_emergency_contact=True,
            )
        )
        for child_position in range(1, child_count + 1):
            child_counter += 1
            gender = "F" if (child_counter + family_index) % 2 == 0 else "M"
            age, age_unit = child_age(child_counter, rng)
            display_label = f"Child {child_position}"
            recipient = Recipient(
                id=demo_uuid(f"child:{child_counter}"),
                campaign_id=campaign.id,
                recipient_group_id=family.id,
                recipient_kind=RECIPIENT_KIND_CHILD,
                program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
                privacy_level=RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
                display_label=display_label,
                public_label=display_label,
                program_recipient_number=child_position,
                program_recipient_id=f"BT-{family_index:03d}-{child_position:02d}",
                first_name=None,
                last_name=None,
                age=age,
                age_unit=age_unit,
                gender=gender,
                address_line1=address_line1,
                city=city,
                state="TX",
                postal_code=postal,
                notes=rng.choice((None, "Loves superheroes.", "Likes art and crafts.", "Needs warm clothing.")),
                status="ACTIVE",
            )
            db.add(recipient)
            children.append(recipient)
            wishlist = Wishlist(
                id=demo_uuid(f"wishlist:child:{child_counter}"),
                campaign_id=campaign.id,
                recipient_id=recipient.id,
                wishlist_status=WISHLIST_STATUS_READY,
                intake_method=WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
                submitted_at=datetime(2026, 10, 15) + timedelta(days=child_counter % 18),
                notes=rng.choice((None, "Sponsor-visible notes reviewed by intake.", "Substitutions are okay unless noted.")),
            )
            db.add(wishlist)
            child_gifts = choose_child_gifts(age, age_unit, gift_count_for_child(child_counter), rng)
            for item_index, gift in enumerate(child_gifts, start=1):
                item_counter += 1
                item = make_wishlist_item(
                    wishlist.id,
                    item_counter,
                    gift,
                    rng,
                    key=f"child:{child_counter}:{item_index}",
                )
                db.add(item)
                all_items.append(item)
    child_counter, item_counter, foster_child_count = seed_foster_care_children(
        db,
        campaign,
        orgs["foster_care"],
        rng,
        children,
        all_items,
        child_counter,
        item_counter,
    )
    adults.extend(seed_nursing_home_adults(db, campaign, orgs["oakmont"], "OAK", 1, 20, rng, all_items, item_counter))
    item_counter = len(all_items)
    adults.extend(seed_nursing_home_adults(db, campaign, orgs["azelway"], "AZ", 21, 20, rng, all_items, item_counter))
    db.flush()
    setattr(campaign, "_demo_foster_child_count", foster_child_count)
    return children, adults, all_items


def seed_foster_care_children(
    db: Session,
    campaign: Campaign,
    org: RecipientGroup,
    rng: random.Random,
    children: list[Recipient],
    all_items: list[WishlistItem],
    child_counter: int,
    item_counter: int,
) -> tuple[int, int, int]:
    foster_child_count = 29
    for local_number in range(1, foster_child_count + 1):
        child_counter += 1
        gender = "F" if local_number % 2 == 0 else "M"
        age, age_unit = child_age(500 + child_counter, rng)
        display_label = f"Foster Child {local_number:03d}"
        recipient = Recipient(
            id=demo_uuid(f"foster-child:{local_number}"),
            campaign_id=campaign.id,
            recipient_group_id=org.id,
            recipient_kind=RECIPIENT_KIND_CHILD,
            program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
            privacy_level=RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
            display_label=display_label,
            public_label=display_label,
            program_recipient_number=local_number,
            program_recipient_id=f"FC-{local_number:03d}",
            first_name=None,
            last_name=None,
            age=age,
            age_unit=age_unit,
            gender=gender,
            address_line1=org.address_line1,
            city=org.city,
            state="TX",
            postal_code=org.postal_code,
            notes=rng.choice(("New placement needs essentials.", "Likes sensory toys.", "Sibling gift coordination preferred.", None)),
            status="ACTIVE",
        )
        db.add(recipient)
        children.append(recipient)
        wishlist = Wishlist(
            id=demo_uuid(f"wishlist:foster-child:{local_number}"),
            campaign_id=campaign.id,
            recipient_id=recipient.id,
            wishlist_status=WISHLIST_STATUS_READY,
            intake_method=WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
            submitted_at=datetime(2026, 10, 18) + timedelta(days=local_number % 16),
            notes=rng.choice(("Entered from agency request list.", "Substitutions are okay.", "Please keep gifts unwrapped for case manager review.")),
        )
        db.add(wishlist)
        child_gifts = choose_child_gifts(age, age_unit, gift_count_for_child(500 + child_counter), rng)
        for item_index, gift in enumerate(child_gifts, start=1):
            item_counter += 1
            item = make_wishlist_item(
                wishlist.id,
                item_counter,
                gift,
                rng,
                key=f"foster-child:{local_number}:{item_index}",
            )
            db.add(item)
            all_items.append(item)
    return child_counter, item_counter, foster_child_count


def seed_nursing_home_adults(
    db: Session,
    campaign: Campaign,
    org: RecipientGroup,
    abbrev: str,
    start_number: int,
    count: int,
    rng: random.Random,
    all_items: list[WishlistItem],
    item_counter: int,
) -> list[Recipient]:
    adults = []
    for offset in range(count):
        number = start_number + offset
        local_number = offset + 1
        first = ADULT_FIRST_NAMES[(number * 3) % len(ADULT_FIRST_NAMES)]
        last = LAST_NAMES[(number * 5) % len(LAST_NAMES)]
        age = rng.randint(75, 100)
        recipient = Recipient(
            id=demo_uuid(f"adult:{abbrev}:{local_number}"),
            campaign_id=campaign.id,
            recipient_group_id=org.id,
            recipient_kind=RECIPIENT_KIND_ADULT,
            program_type=RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
            privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
            display_label=f"{first} {last}",
            public_label=f"{first} {last[0]}.",
            program_recipient_number=local_number,
            program_recipient_id=f"{abbrev}-{local_number:03d}",
            first_name=first,
            last_name=last,
            age=age,
            age_unit=RECIPIENT_AGE_UNIT_YEARS,
            gender="F" if first in FIRST_NAMES_F or first in {"Alice", "Beatrice", "Betty", "Carmen", "Delores", "Edna", "Gloria", "Irene", "Linda", "Maria", "Martha"} else "M",
            address_line1=org.address_line1,
            city=org.city,
            state="TX",
            postal_code=org.postal_code,
            facility_room=f"{rng.randint(100, 399)}{rng.choice(('A', 'B', ''))}",
            mobility_notes=rng.choice((None, "Uses walker.", "Wheelchair accessible pickup.", "Prefers large print.")),
            status="ACTIVE",
        )
        db.add(recipient)
        adults.append(recipient)
        wishlist = Wishlist(
            id=demo_uuid(f"wishlist:adult:{abbrev}:{local_number}"),
            campaign_id=campaign.id,
            recipient_id=recipient.id,
            wishlist_status=WISHLIST_STATUS_READY,
            intake_method=WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
            submitted_at=datetime(2026, 10, 20) + timedelta(days=offset % 10),
            notes="Entered from facility request sheet.",
        )
        db.add(wishlist)
        for gift_index in range(1, 2 + (1 if (offset % 3 == 0) else 0)):
            item_counter += 1
            item = make_wishlist_item(
                wishlist.id,
                item_counter,
                rng.choice(ADULT_GIFTS),
                rng,
                key=f"adult:{abbrev}:{local_number}:{gift_index}",
            )
            db.add(item)
            all_items.append(item)
    return adults


def make_wishlist_item(
    wishlist_id: uuid.UUID,
    item_counter: int,
    gift: tuple[str, str, str, str | None],
    rng: random.Random,
    *,
    key: str,
) -> WishlistItem:
    category, item_type, description, size = gift
    priority = rng.choices(("HIGH", "MEDIUM", "LOW"), weights=(25, 65, 10), k=1)[0]
    return WishlistItem(
        id=demo_uuid(f"wishlist-item:{key}"),
        wishlist_id=wishlist_id,
        category=category,
        item_type=item_type,
        description=description,
        size=size,
        qty_requested=1,
        priority=priority,
        est_cost_cents=rng.choice((1500, 2000, 2500, 3000, 3500, 4000, 5000, None)),
        allow_substitute=True,
        recipient_note=rng.choice((None, "Favorite colors are blue or green.", "Any similar brand is fine.", "Please avoid scented items.")),
        status="OPEN",
        qty_fulfilled=0,
        label_code=f"{LABEL_CODE_PREFIX}-{item_counter:04d}",
        notes=rng.choice((None, "Seeded demo wishlist item.", "Good candidate for sponsor walkthrough.")),
    )


def seed_gift_pool_inventory(db: Session, campaign: Campaign, received_by_user_id: uuid.UUID) -> int:
    donations = [
        (
            "DROP_OFF",
            "Community toy drive overflow",
            datetime(2026, 12, 3, 10, 30),
            [
                ("Remote control race cars", "Toy", None, 8, 5, 12, "M", 2500, "RC cars and trucks for elementary kids."),
                ("Lego and compatible brick sets", "Toy", None, 6, 6, 14, "ANY", 3000, "Mixed medium-size boxed building sets."),
                ("Batman and superhero action figures", "Toy", None, 5, 4, 10, "ANY", 1800, "Popular character toys for quick matching."),
                ("Nintendo Switch game cards", "Video Games", None, 3, 9, 18, "ANY", 4500, "Family-friendly game cards from donor drop-off."),
                ("Art kits with sketch pads", "Art", None, 5, 6, 16, "ANY", 2200, "Markers, pencils, sketch pads, and craft supplies."),
            ],
        ),
        (
            "SHIPMENT",
            "Corporate winter clothing shipment",
            datetime(2026, 12, 4, 14, 0),
            [
                ("Winter coats", "Outerwear", "Youth medium", 7, 7, 11, "ANY", 4500, "Neutral colors; good for BT and FC children."),
                ("Winter coats", "Outerwear", "Youth large", 5, 10, 14, "ANY", 4800, "Mostly black, navy, and purple coats."),
                ("Hoodies", "Clothing", "Adult small", 9, 12, 18, "ANY", 2800, "Teen sizes from the clothing drive."),
                ("Sneakers", "Shoes", "Youth 4", 4, 7, 10, "ANY", 3500, "New athletic shoes; assorted colors."),
                ("Warm pajama sets", "Clothing", "Girls 8", 6, 7, 9, "F", 2400, "Soft winter pajama sets."),
            ],
        ),
        (
            "CHURCH_PURCHASE",
            "Blessing Tree emergency needs closet",
            datetime(2026, 12, 5, 9, 15),
            [
                ("Baby board books and rattles", "Baby", None, 8, 0, 2, "ANY", 1600, "Good substitute for infant wishlist toys."),
                ("Toddler learning toys", "Toy", None, 7, 1, 4, "ANY", 2000, "Shape sorters, stacking toys, and music toys."),
                ("Teen hygiene kits", "Essentials", None, 12, 12, 18, "ANY", 1800, "Shampoo, deodorant, body wash, socks."),
                ("$25 Target gift cards", "Gift Card", "$25", 10, None, None, "ANY", 2500, "Flexible operational assignment for hard-to-match wishes."),
                ("Sports balls", "Sports", None, 6, 7, 15, "ANY", 1700, "Basketballs, soccer balls, and footballs."),
            ],
        ),
        (
            "OTHER",
            "Senior ministry donated items",
            datetime(2026, 12, 6, 11, 45),
            [
                ("Large print puzzle books", "Activities", None, 12, 75, 100, "ANY", 1200, "Crosswords, word searches, and sudoku."),
                ("Fleece lap blankets", "Comfort", None, 10, 75, 100, "ANY", 2200, "Soft neutral blankets for nursing home residents."),
                ("Non-slip socks", "Essentials", "Adult", 16, 75, 100, "ANY", 900, "Grippy socks for nursing home residents."),
                ("Unscented lotion gift sets", "Personal Care", None, 8, 75, 100, "ANY", 1500, "Sensitive-skin lotion and hand cream."),
                ("Bird calendar and stationery sets", "Activities", None, 5, 75, 100, "ANY", 1400, "Calendars, note cards, and pens."),
            ],
        ),
    ]

    line_count = 0
    for donation_index, (source, label, received_at, lines) in enumerate(donations, start=1):
        donation = Donation(
            id=demo_uuid(f"donation:{donation_index}"),
            campaign_id=campaign.id,
            source=source,
            received_at=received_at,
            received_by_user_id=received_by_user_id,
            notes=label,
        )
        db.add(donation)
        for line_index, (description, category, size, quantity, age_min, age_max, gender_fit, value_cents, notes) in enumerate(
            lines,
            start=1,
        ):
            db.add(
                DonationLine(
                    id=demo_uuid(f"donation-line:{donation_index}:{line_index}"),
                    donation_id=donation.id,
                    campaign_id=campaign.id,
                    line_type="GOODS",
                    description=description,
                    category=category,
                    size=size,
                    quantity=quantity,
                    quantity_available=quantity,
                    quantity_assigned=0,
                    estimated_value_cents=value_cents,
                    age_min=age_min,
                    age_max=age_max,
                    gender_fit=gender_fit,
                    gift_condition="NEW",
                    source_label=label,
                    status="UNASSIGNED",
                    inventory_status="AVAILABLE",
                    received_by_user_id=received_by_user_id,
                    notes=notes,
                )
            )
            line_count += 1
    db.flush()
    return line_count


def seed_sponsors(
    db: Session,
    campaign: Campaign,
    sponsor_user_id: uuid.UUID,
    rng: random.Random,
) -> tuple[list[Sponsor], list[Sponsorship]]:
    sponsors: list[Sponsor] = []
    sponsorships: list[Sponsorship] = []
    for index in range(1, 93):
        is_org = index % 11 == 0
        first = SPONSOR_FIRST_NAMES[index % len(SPONSOR_FIRST_NAMES)]
        last = LAST_NAMES[(index * 9) % len(LAST_NAMES)]
        source = SPONSOR_SOURCE_STAFF_ENTRY if index <= 54 else (SPONSOR_SOURCE_PUBLIC_QR if index % 2 == 0 else SPONSOR_SOURCE_PUBLIC_LINK)
        display_name = SPONSOR_ORGS[(index // 11) % len(SPONSOR_ORGS)] if is_org else f"{first} {last}"
        email_name = display_name.lower().replace(" ", ".").replace("&", "and")
        address_line1, city, postal = address_for_index(300 + index)
        sponsor = Sponsor(
            id=demo_uuid(f"sponsor:{index}"),
            first_name=None if is_org else first,
            last_name=None if is_org else last,
            display_name=display_name,
            organization_name=display_name if is_org else (rng.choice(SPONSOR_ORGS) if index % 7 == 0 else None),
            email=f"{email_name}{index}@example.test",
            phone=phone_for_index(500 + index),
            address_line1=address_line1,
            city=city,
            state="TX",
            postal_code=postal,
            preferred_contact=rng.choice(("EMAIL", "TEXT", "PHONE")),
            source=source,
            source_detail="Demo public signup" if source != SPONSOR_SOURCE_STAFF_ENTRY else "Staff-entered demo sponsor",
            notes=rng.choice((None, "Interested in sponsoring siblings.", "Prefers email reminders.", "Can help with last-minute needs.")),
            is_active=True,
            self_registered_at=datetime(2026, 11, 2) + timedelta(days=index % 20) if source != SPONSOR_SOURCE_STAFF_ENTRY else None,
            last_contacted_at=datetime(2026, 11, 10) + timedelta(days=index % 18) if index % 4 != 0 else None,
            do_not_contact=False,
        )
        sponsorship = Sponsorship(
            id=demo_uuid(f"sponsorship:{index}"),
            campaign_id=campaign.id,
            sponsor_id=sponsor.id,
            sponsor_code=f"SP-{index:03d}",
            status=SPONSORSHIP_STATUS_ACTIVE,
            interest_status=interest_status_for(index),
            drop_off_status=SPONSORSHIP_DROP_OFF_STATUS_SCHEDULED if index % 6 == 0 else SPONSORSHIP_DROP_OFF_STATUS_NOT_STARTED,
            drop_off_due_at=datetime(2026, 12, 18, 17),
            self_registered=source != SPONSOR_SOURCE_STAFF_ENTRY,
            notes=("Committed verbally to sponsor 3 kids but has not selected gifts yet." if index in {8, 19, 37, 58, 73} else None),
        )
        db.add(sponsor)
        db.add(sponsorship)
        sponsors.append(sponsor)
        sponsorships.append(sponsorship)
        if source != SPONSOR_SOURCE_STAFF_ENTRY:
            db.add(
                PendingSponsorRegistration(
                    id=demo_uuid(f"pending-sponsor:{index}"),
                    campaign_id=campaign.id,
                    matched_sponsor_id=sponsor.id,
                    email=sponsor.email or f"sponsor{index}@example.test",
                    first_name=sponsor.first_name,
                    last_name=sponsor.last_name,
                    display_name=sponsor.display_name,
                    organization_name=sponsor.organization_name,
                    phone=sponsor.phone,
                    preferred_contact=sponsor.preferred_contact,
                    address_line1=sponsor.address_line1,
                    city=sponsor.city,
                    state=sponsor.state,
                    postal_code=sponsor.postal_code,
                    source=source,
                    selected_wishlist_item_ids_json=[],
                    notes="Demo public sponsor registration.",
                    verification_token=f"{CAMPAIGN_SLUG}-token-{index:03d}",
                    verification_sent_at=datetime(2026, 11, 1, 9) + timedelta(days=index % 15),
                    verified_at=(datetime(2026, 11, 1, 10) + timedelta(days=index % 15)) if index % 9 != 0 else None,
                    expires_at=datetime(2026, 12, 12, 23, 59),
                    status=PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED if index % 9 != 0 else PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
                    submitted_ip=f"10.20.30.{index % 250}",
                    user_agent="BlessingTreeDemo/2026",
                )
            )
    db.flush()
    return sponsors, sponsorships


def seed_commitments(
    db: Session,
    wishlist_items: list[WishlistItem],
    sponsorships: list[Sponsorship],
    rng: random.Random,
) -> int:
    target_count = max(1, round(len(wishlist_items) * 0.10))
    selected_items = rng.sample(wishlist_items, target_count)
    eligible_sponsorships = [item for idx, item in enumerate(sponsorships, start=1) if idx not in {8, 19, 37, 58, 73}]
    active_sponsorships = eligible_sponsorships[:46]
    commitment_counts = {sponsorship.id: 0 for sponsorship in active_sponsorships}
    for index, item in enumerate(selected_items, start=1):
        available = [
            sponsorship
            for sponsorship in active_sponsorships
            if commitment_counts[sponsorship.id] < (5 if index % 7 == 0 else 3)
        ] or active_sponsorships
        sponsorship = rng.choice(available)
        commitment_counts[sponsorship.id] += 1
        item.status = "COMMITTED"
        db.add(
            SponsorshipItem(
                id=demo_uuid(f"sponsorship-item:{item.id}"),
                sponsorship_id=sponsorship.id,
                wishlist_item_id=item.id,
                qty_committed=1,
                committed_at=datetime(2026, 11, 20, 10) + timedelta(hours=index),
                notes=rng.choice((None, "Sponsor selected through Gift Search.", "Staff committed after phone call.")),
            )
        )
        sponsorship.interest_status = SPONSORSHIP_INTEREST_STATUS_COMMITTED
    db.flush()
    return target_count


def seed_sponsor_interactions(
    db: Session,
    campaign: Campaign,
    sponsors: list[Sponsor],
    sponsorships: list[Sponsorship],
    user_id: uuid.UUID,
    rng: random.Random,
) -> None:
    for index, sponsor in enumerate(sponsors, start=1):
        sponsorship = sponsorships[index - 1]
        if sponsor.source != SPONSOR_SOURCE_STAFF_ENTRY:
            db.add(
                SponsorInteraction(
                    id=demo_uuid(f"sponsor-interaction:signup:{index}"),
                    campaign_id=campaign.id,
                    sponsor_id=sponsor.id,
                    channel="EMAIL",
                    direction="INBOUND",
                    subject="Public sponsor signup",
                    origin_type=SPONSOR_INTERACTION_ORIGIN_PUBLIC_SIGNUP,
                    outcome="REACHED",
                    notes="Sponsor registered through the public portal.",
                    occurred_at=sponsor.self_registered_at or datetime(2026, 11, 2),
                    created_by_user_id=None,
                    related_sponsorship_id=sponsorship.id,
                )
            )
        if index % 4 == 0:
            continue
        follow_up = None
        if index % 2 == 0 or index % 5 == 0 or sponsorship.interest_status in {
            SPONSORSHIP_INTEREST_STATUS_NEW,
            SPONSORSHIP_INTEREST_STATUS_CONTACTED,
            SPONSORSHIP_INTEREST_STATUS_RESPONDED,
        }:
            follow_up = datetime(2026, 12, 2, 9) + timedelta(days=index % 12, hours=index % 6)
        db.add(
            SponsorInteraction(
                id=demo_uuid(f"sponsor-interaction:manual:{index}"),
                campaign_id=campaign.id,
                sponsor_id=sponsor.id,
                channel=rng.choice(("CALL", "EMAIL", "TEXT")),
                direction="OUTBOUND",
                subject=rng.choice(("Initial sponsor follow-up", "Gift commitment check-in", "Drop-off planning")),
                origin_type=SPONSOR_INTERACTION_ORIGIN_MANUAL,
                outcome=rng.choice(("REACHED", "LEFT_VM", "PROMISED_DATE", "OTHER")),
                notes=rng.choice(("Reviewed sponsor interest.", "Asked sponsor to select gifts online.", "Confirmed sponsor can receive reminders.")),
                occurred_at=datetime(2026, 11, 12, 11) + timedelta(days=index % 17),
                created_by_user_id=user_id,
                follow_up_at=follow_up,
                related_sponsorship_id=sponsorship.id,
            )
        )


def interest_status_for(index: int) -> str:
    if index in {8, 19, 37, 58, 73}:
        return SPONSORSHIP_INTEREST_STATUS_COMMITTED
    if index % 5 == 0:
        return SPONSORSHIP_INTEREST_STATUS_RESPONDED
    if index % 3 == 0:
        return SPONSORSHIP_INTEREST_STATUS_CONTACTED
    return SPONSORSHIP_INTEREST_STATUS_NEW


def child_age(counter: int, rng: random.Random) -> tuple[int, str]:
    if counter % 25 == 0:
        return rng.randint(3, 11), RECIPIENT_AGE_UNIT_MONTHS
    return rng.randint(1, 18), RECIPIENT_AGE_UNIT_YEARS


def gift_count_for_child(counter: int) -> int:
    if counter % 20 == 0:
        return 5
    if counter % 9 == 0:
        return 4
    if counter % 7 == 0:
        return 2
    if counter % 31 == 0:
        return 1
    return 3


def choose_child_gifts(
    age: int | None,
    age_unit: str | None,
    count: int,
    rng: random.Random,
) -> list[tuple[str, str, str, str | None]]:
    if age_unit == RECIPIENT_AGE_UNIT_MONTHS or (age is not None and age <= 2):
        bucket = list(KID_GIFTS["baby"])
    elif age is not None and age >= 13:
        bucket = list(KID_GIFTS["teen"])
    else:
        bucket = list(KID_GIFTS["child"])

    if count <= len(bucket):
        return rng.sample(bucket, k=count)
    return [rng.choice(bucket) for _ in range(count)]


def address_for_index(index: int) -> tuple[str, str, str]:
    city, postal = HOUSTON_CITIES[index % len(HOUSTON_CITIES)]
    street = HOUSTON_STREETS[(index * 3) % len(HOUSTON_STREETS)]
    return f"{1100 + (index * 37) % 7800} {street}", city, postal


def unique_guardian_names(rng: random.Random, count: int) -> list[tuple[str, str]]:
    first_names = list(GUARDIAN_FIRST_NAMES)
    rng.shuffle(first_names)
    while len(first_names) < count:
        first_names.extend(rng.sample(list(GUARDIAN_FIRST_NAMES), k=min(len(GUARDIAN_FIRST_NAMES), count - len(first_names))))

    last_names = list(LAST_NAMES)
    rng.shuffle(last_names)
    while len(last_names) < count:
        extra_last_names = list(LAST_NAMES)
        rng.shuffle(extra_last_names)
        last_names.extend(extra_last_names)

    return list(zip(first_names[:count], last_names[:count], strict=True))


def phone_for_index(index: int) -> str:
    area = AREA_CODES[index % len(AREA_CODES)]
    prefix = 200 + (index * 17) % 700
    line = 1000 + (index * 83) % 9000
    return f"{area}{prefix:03d}{line:04d}"


def demo_uuid(key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"{SEED_NAMESPACE}:{key}")


def print_summary(summary: dict[str, int]) -> None:
    print("Seeded Blessing Tree Demo 2026")
    for key, value in summary.items():
        print(f"{key}: {value}")
    print(f"demo_password: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()
