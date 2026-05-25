# Gift Workflow Design

Last updated: 2026-05-24

## Status

- Proposed for implementation planning.
- This design follows the existing recipient, sponsor, campaign readiness, and
  automation designs.
- Implementation sequencing lives in:
  - `docs/engineering/gift-workflow-implementation-plan.md`

Related design:

- `docs/engineering/campaign-recipient-design.md`
- `docs/engineering/campaign-sponsor-workspace-design.md`
- `docs/engineering/campaign-readiness-design.md`
- `docs/engineering/campaign-schedule-design.md`
- `docs/engineering/queryforge-reuse-plan.md`

## Purpose

The gift workflow is the operational core that connects:

- recipient wishlists
- sponsor commitments
- self-service sponsor gift selection
- donated inventory that is not tied to a wishlist yet
- receiving, wrapping, tagging, and distribution
- reminder automation
- reporting

The current system already has the base entities:

- `wishlist_item`
- `sponsorship`
- `sponsorship_item`
- `donation`
- `donation_line`
- `fulfillment`
- `label_print_job`
- `label_print_item`
- `scan_event`
- `item_event`
- `pickup`
- `pickup_item`

This design makes those pieces into a coherent workflow and adds the missing
search, matching, operations, automation, and reporting surfaces.

## Goals

1. Let staff and public sponsors find eligible gifts using structured filters
   and natural-language input.
2. Let sponsors reserve or commit to gifts without double-booking inventory.
3. Let staff commit gifts on behalf of sponsors and override operational issues.
4. Support donated goods that are not originally tied to a wishlist.
5. Match donated gift inventory to open wishlist needs.
6. Track every gift through received, wrapped, tagged, ready, and distributed.
7. Print QR-coded gift tags and support staff scan flows.
8. Send configurable sponsor reminders around campaign milestones.
9. Produce reliable operational reporting.

## Non-Goals For The First Release

- Full AI autonomous matching.
- Public sponsor access to recipient personally identifying details.
- Barcode scanner hardware integration beyond camera/manual QR scan support.
- Accounting-grade donation receipting.
- Shipping carrier integration.

## Core Concepts

### Wishlist Need

`wishlist_item` represents a need or requested gift for one recipient.

It answers:

- who is this gift for?
- what was requested?
- what size/category/priority applies?
- what is the current recipient-facing fulfillment state?

It should not become the only inventory model.

### Sponsor Commitment

`sponsorship_item` connects a sponsor participation record to a wishlist item.

It answers:

- who committed to bring this specific wishlist item?
- when did they commit?
- how many units are committed?

The uniqueness constraint on `sponsorship_item.wishlist_item_id` remains the
hard guard that prevents two sponsors from owning the same wishlist item.

### Donated Gift Inventory

`donation` and `donation_line` represent physical or monetary donations.

Examples:

- a group donates 30 coats
- someone drops off generic gift cards
- a sponsor drops off the exact gift they committed to
- a church buys bulk toys for matching

`donation_line` should evolve into the durable inventory unit for goods that
can be assigned to wishlist items.

### Fulfillment Link

`fulfillment` connects a `donation_line` to a `wishlist_item`.

It answers:

- which donated/received goods satisfy this wishlist need?
- how many units were applied?
- who performed the match?

Sponsor-committed gifts and unmatched donated inventory both converge here once
the item is physically received and applied to a recipient need.

### Physical Gift Workflow

Physical workflow state is expressed on `wishlist_item`, with auditable events
in `item_event` and QR scan history in `scan_event`.

Recommended effective states:

- `OPEN`
- `RESERVED`
- `COMMITTED`
- `RECEIVED`
- `WRAPPED`
- `TAGGED`
- `READY_FOR_DISTRIBUTION`
- `DISTRIBUTED`
- `EXCEPTION`
- `CANCELLED`

Current schema has fewer enum values:

- `OPEN`
- `COMMITTED`
- `RECEIVED`
- `WRAPPED`
- `PICKED_UP`
- `CANCELLED`

The first implementation can either:

- expand the enum to the recommended state set, or
- keep the current enum and derive intermediate states from related rows:
  - tagged from `label_last_printed_at`
  - distributed from `pickup_item` or `picked_up_at`
  - exceptions from `item_event`

Recommendation: expand the enum now. Gift operations will be clearer and
reporting will be less fragile.

## User Workflows

## 1. Staff Gift Finder

Staff need a campaign-scoped gift search page.

Route recommendation:

- `/campaigns/:campaignId/gifts/search`

Primary use cases:

- search open wishlist needs
- search all committed/received gifts
- reserve or commit gifts on behalf of a sponsor
- see sponsor commitment state
- see recipient context when authorized
- override or release commitments

Search inputs:

- natural-language query
- age range
- age unit
- gender
- program type
- group/organization
- item type
- category
- size
- priority
- estimated cost range
- sponsorship status
- fulfillment state
- public eligibility

Staff result rows should include:

- gift description
- item type/category/size
- recipient display label and program ID
- age/gender when available
- group/organization context
- priority
- sponsorship status
- fulfillment state
- label code
- action buttons

Staff actions:

- reserve for existing sponsor
- create sponsor and commit
- release reservation/commitment
- mark received
- add to print queue
- open recipient
- open sponsor

## 2. Public Sponsor Gift Finder

Self-service sponsors need a public-safe gift search experience.

This can be an enhancement of the existing public sponsor signup flow.

Route recommendation:

- existing: `/public/campaigns/:publicSlug/sponsor`
- optional future deep link: `/public/campaigns/:publicSlug/gifts`

Public results must not expose sensitive recipient data.

Allowed public fields:

- first name or anonymized display label based on campaign config
- age or age band
- gender, if campaign allows it
- item description
- size/category
- approximate cost, if available
- priority only if phrased safely

Public actions:

- select up to campaign-configured max gifts
- submit sponsor identity
- verify email
- commit selected gifts after verification

Public restrictions:

- only `OPEN` and public-eligible wishlist items
- no cancelled/inactive recipient records
- no do-not-publish recipient details
- no direct address, phone, full household, or contact details

## Natural-Language Search

Natural-language search should be a filter parser, not an opaque AI result set.

Recommended flow:

1. User enters: `winter coats for girls age 8 to 12`
2. Backend parses into:
   - category: `clothing`
   - item keywords: `coat`, `jacket`, `outerwear`, `winter`
   - gender: `F`
   - min age: `8`
   - max age: `12`
3. UI shows editable chips:
   - `Girls`
   - `Age 8-12`
   - `Clothing`
   - `coat OR jacket OR outerwear`
4. Search runs through normal deterministic filters.

Parser strategy:

- deterministic parsing first
- synonym catalog for gift terms
- optional LLM-assisted parser later, returning the same structured filter
  contract
- never let the LLM decide final authorization or eligibility

Recommended parser output:

```json
{
  "query": "winter coats for girls age 8 to 12",
  "filters": {
    "keywords": ["coat", "jacket", "outerwear", "winter"],
    "category": ["clothing"],
    "gender": ["F"],
    "age_min": 8,
    "age_max": 12,
    "status": ["OPEN"]
  },
  "confidence": "HIGH",
  "chips": [
    { "key": "gender", "label": "Girls" },
    { "key": "age", "label": "Age 8-12" },
    { "key": "category", "label": "Clothing" }
  ]
}
```

## Gift Reservation And Commitment

The workflow should distinguish reservation from commitment.

### Reservation

Reservation means a gift is temporarily held.

Used for:

- public sponsor selection before email verification
- staff staging a sponsor commitment before final save
- checkout-like sponsor flow

Recommended model:

- add `gift_reservation`

Fields:

- `id`
- `campaign_id`
- `wishlist_item_id`
- `sponsor_id` nullable
- `pending_sponsor_registration_id` nullable
- `reserved_by_user_id` nullable
- `reservation_source`
  - `PUBLIC_SIGNUP`
  - `STAFF`
  - `SYSTEM`
- `expires_at`
- `status`
  - `ACTIVE`
  - `COMMITTED`
  - `RELEASED`
  - `EXPIRED`
- timestamps

Rules:

- one active reservation per wishlist item
- reservation expires automatically
- verified public signup converts reservation to sponsorship item
- staff commit converts reservation to sponsorship item
- commit must still rely on `sponsorship_item.wishlist_item_id` uniqueness

### Commitment

Commitment means a sponsor owns responsibility for the gift.

Implemented through:

- `sponsorship`
- `sponsorship_item`
- `wishlist_item.status = COMMITTED`
- `item_event(event_type = COMMITTED)`

Commit flow must be transactionally safe:

1. lock or re-check wishlist item availability
2. create or reuse campaign sponsorship
3. create `sponsorship_item`
4. set wishlist item state
5. record item event
6. commit
7. return conflict if uniqueness fails

## Donated Gift Pool

Donated inventory is not always tied to a sponsor commitment or wishlist.

Examples:

- coats donated in bulk
- toy drive inventory
- gift cards
- extra items after sponsor drop-off

Recommended evolution of `donation_line`:

Add fields:

- `campaign_id` denormalized from donation for faster searching
- `age_min`
- `age_max`
- `gender_fit`
  - `ANY`
  - `F`
  - `M`
  - `UNSPECIFIED`
- `quantity_available`
- `quantity_assigned`
- `inventory_status`
  - `AVAILABLE`
  - `PARTIALLY_ASSIGNED`
  - `ASSIGNED`
  - `CONSUMED`
  - `ARCHIVED`
- `gift_condition`
  - `NEW`
  - `LIKE_NEW`
  - `USED_ACCEPTABLE`
- `source_label`
- `received_by_user_id`

Current `donation_line.status` can be migrated into `inventory_status`.

## Inventory Matching

Staff need an operations screen to match donated inventory to wishlist needs.

Route recommendation:

- `/campaigns/:campaignId/gifts/pool`

Matching inputs:

- donated item category
- description keywords
- size
- age range overlap
- gender fit
- wishlist priority
- open status
- program/group constraints

Suggested match scoring:

- exact category match: +30
- keyword/synonym match: +30
- size match: +20
- age overlap: +20
- gender compatibility: +15
- high priority wishlist item: +10
- same group/program preference when applicable: +5

Actions:

- assign donated inventory to wishlist item
- split quantity across multiple wishlist items
- mark inventory archived/unusable
- create a new generic wishlist need if staff chooses to track it that way

Assignment creates:

- `fulfillment`
- updates donation quantities/status
- updates wishlist item fulfillment status
- records `item_event`

## Gift Operations Screen

Route recommendation:

- `/campaigns/:campaignId/gifts/operations`

This should be the main staff operations surface.

Views:

- table view
- kanban/state view
- scanner-friendly receiving mode
- print queue

Columns/states:

- Reserved
- Committed
- Overdue
- Received
- Wrapped
- Tagged
- Ready
- Distributed
- Exception

Common actions:

- mark received
- mark wrapped
- print tag
- reprint tag
- mark ready
- scan/distribute
- record exception
- release/replace sponsor
- open sponsor
- open recipient

Bulk actions:

- print selected tags
- mark selected received
- mark selected wrapped
- assign storage location
- export list

## Receiving

When a sponsor brings in a committed gift:

1. staff searches by sponsor, sponsor code, label code, or gift description
2. staff opens the committed item
3. staff marks received
4. optional donation row is created or linked
5. wishlist item moves to `RECEIVED`
6. sponsor participation drop-off state is updated
7. item event is recorded

For donated pool items:

1. staff creates donation
2. adds one or more donation lines
3. assigns storage location
4. item enters inventory as available

## Wrapping

Wrapping is an operational state on the wishlist item.

Action:

- mark wrapped

Effects:

- `wishlist_item.status = WRAPPED`
- `wrapped_at`
- `wrapped_by_user_id`
- `item_event(event_type = WRAPPED)`

Wrapping may happen before or after tag printing, but operational readiness
should require both wrapped and tagged.

## Gift Tags And QR Codes

Each fulfilled gift needs a printable tag.

Tag contents:

- campaign name/year
- recipient program ID or display label
- recipient first name or anonymized label based on config
- group/organization label
- gift description
- size/category
- label code
- QR code

QR code target:

- protected staff route
- opaque label code or scan token
- never public recipient identifiers

Route recommendation:

- `/scan/gifts/:labelCode`

Backend lookup:

- `GET /api/v1/campaigns/<campaign_id>/gifts/scan/<label_code>`

Scan actions:

- lookup only
- mark received
- mark wrapped
- mark distributed
- reprint tag
- report exception

Every scan should create `scan_event`.

## Distribution / Pickup

The current model has:

- `pickup`
- `pickup_item`
- `wishlist_item.picked_up_at`

Future naming should support both household pickup and delivery to organizations.

Recommended operational label:

- `DISTRIBUTED`

Pickup/delivery methods:

- `PICKUP`
- `DELIVERED`

Distribution action:

1. scan QR code
2. confirm recipient/group
3. choose pickup contact or delivery method
4. mark item distributed
5. create `pickup` and `pickup_item` when needed
6. set `wishlist_item.status = DISTRIBUTED`
7. record `scan_event` and `item_event`

## Reminder Automation

Sponsor reminders should be campaign-configurable and milestone-aware.

Reminder types:

- confirmation after commitment
- upcoming gift turn-in deadline
- overdue after gift turn-in deadline
- final reminder before distribution/wrapping
- receipt confirmation after gift is checked in

Recommended new model:

- `campaign_gift_reminder_rule`

Fields:

- `id`
- `campaign_id`
- `rule_key`
- `label`
- `is_enabled`
- `audience`
  - `SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS`
  - `SPONSORS_WITH_OVERDUE_GIFTS`
  - `SPONSORS_WITH_RECEIVED_GIFTS`
- `milestone_key`
- `offset_days`
- `send_time_local`
- `template_id`
- `channel`
  - `EMAIL`
- `suppress_if_all_received`
- `created_at`
- `updated_at`

Recommended integration with existing automation:

- campaign beat task evaluates due reminder rules
- resolver selects sponsors and outstanding gifts
- dispatch uses campaign communication template infrastructure
- create `sponsor_interaction` for every send attempt
- create or update `sponsor_reminder` rows if useful for per-sponsor tracking

Readiness checks:

- warning if reminder enabled without template
- blocker if public sponsor flow enabled but gift turn-in milestone missing
- warning if gift turn-in reminder enabled but no gift turn-in milestone exists

## API Surface

### Gift Search

Staff:

- `GET /api/v1/campaigns/<campaign_id>/gifts/search`
- `POST /api/v1/campaigns/<campaign_id>/gifts/search/parse`

Public:

- `GET /api/v1/public/campaigns/<public_slug>/gifts/search`
- `POST /api/v1/public/campaigns/<public_slug>/gifts/search/parse`

### Reservations And Commitments

- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/reserve`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/commit`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/release`

Public flow can keep using pending sponsor registration endpoints, but should
move selected gifts through the shared reservation service.

### Operations

- `GET /api/v1/campaigns/<campaign_id>/gifts/operations`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/receive`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/wrap`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/tag`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/distribute`
- `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/exception`

### Gift Pool

- `GET /api/v1/campaigns/<campaign_id>/gift-pool`
- `POST /api/v1/campaigns/<campaign_id>/donations`
- `PATCH /api/v1/campaigns/<campaign_id>/donations/<donation_id>`
- `POST /api/v1/campaigns/<campaign_id>/donations/<donation_id>/lines`
- `PATCH /api/v1/campaigns/<campaign_id>/donation-lines/<line_id>`
- `GET /api/v1/campaigns/<campaign_id>/donation-lines/<line_id>/matches`
- `POST /api/v1/campaigns/<campaign_id>/donation-lines/<line_id>/assign`

### Labels And Scan

- `POST /api/v1/campaigns/<campaign_id>/gift-labels/print-jobs`
- `GET /api/v1/campaigns/<campaign_id>/gift-labels/print-jobs/<job_id>`
- `GET /api/v1/campaigns/<campaign_id>/gifts/scan/<label_code>`
- `POST /api/v1/campaigns/<campaign_id>/gifts/scan/<label_code>/actions`

### Reminder Rules

- `GET /api/v1/campaigns/<campaign_id>/gift-reminder-rules`
- `POST /api/v1/campaigns/<campaign_id>/gift-reminder-rules`
- `PATCH /api/v1/campaigns/<campaign_id>/gift-reminder-rules/<rule_id>`

## Frontend Surfaces

### Staff Navigation

Add campaign child nav:

- Gifts
  - Search
  - Operations
  - Gift Pool
  - Reports

This can come after the current Sponsor and People nav work.

### Staff Gift Search

Main screen:

- natural-language search bar
- interpreted filter chips
- structured filter drawer
- result table
- sponsor commit drawer

### Public Gift Search

Enhance public sponsor signup:

- search first or sponsor info first can be a campaign config choice
- public-safe result cards
- selected gift tray
- verification warning/status

Recommendation:

- keep the current sponsor info plus gift selection flow for phase 1
- add NL/filter search inside the gift selection step

### Gift Operations

Main screen:

- state tabs or pipeline columns
- dense table for repeated staff work
- bulk action toolbar
- selected gift drawer
- print queue drawer

### Gift Pool

Main screen:

- donation/inventory intake drawer
- inventory table
- match suggestions drawer
- assignment confirmation

### Scan Screen

Mobile-first:

- lookup result
- large state action buttons
- recipient/gift summary
- exception action

## Reporting Requirements

Gift reporting should answer:

- how many wishlist needs are open?
- how many are reserved/committed?
- how many are received?
- how many are wrapped?
- how many are tagged?
- how many are ready?
- how many are distributed?
- what is overdue?
- which sponsors have outstanding gifts?
- which recipient groups are missing gifts?
- what donated inventory is unmatched?
- what inventory was assigned?

Recommended report groups:

- sponsorship coverage
- gift pipeline
- sponsor drop-off status
- donated inventory pool
- distribution readiness
- exception list

## Authorization

Suggested capabilities:

- `campaign.gifts.view`
- `campaign.gifts.manage`
- `campaign.gifts.receive`
- `campaign.gifts.print_labels`
- `campaign.gifts.distribute`
- `campaign.gift_pool.manage`
- `campaign.gift_reminders.manage`

Public sponsor endpoints remain anonymous but campaign-gated and rate-limited.

## Audit And Safety

Every state-changing action should record:

- actor user ID when authenticated
- timestamp
- old state
- new state
- reason/notes when applicable
- related sponsor/donation/pickup context

Use:

- `item_event` for gift state history
- `scan_event` for QR-driven operations
- `sponsor_interaction` for sponsor communication history

## Open Decisions

1. Should public sponsor search show recipient first name, anonymized label, or
   only age/gender/context?
2. Should staff be allowed to reserve gifts without attaching a sponsor?
3. Should reminder rules be campaign-specific only, or should Admin Campaign
   Operations define reusable default reminder templates?
4. Should tag printing target Avery-style sheets first or small thermal labels?
5. Should `PICKED_UP` be renamed to `DISTRIBUTED` in schema, or should we keep
   the old value and use UI copy to generalize pickup/delivery?

## Recommended Decisions

1. Public search should default to anonymized labels plus age/gender/category.
   Campaign config can allow first names later.
2. Staff reservations should be allowed, but should expire quickly and show who
   created them.
3. Admin Campaign Operations should eventually define defaults; campaign-level
   rules should own the actual enabled/disabled schedule.
4. Start with PDF/Avery-style sheet output because it is easiest to test and
   print from browsers; support thermal labels later.
5. Expand the enum to `DISTRIBUTED` while keeping a compatibility serializer for
   existing `PICKED_UP` rows.
