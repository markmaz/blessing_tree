# Gift Workflow Implementation Plan

Last updated: 2026-05-24

## Status

- In progress.
- Follows `docs/engineering/gift-workflow-design.md`.
- QueryForge reuse guidance lives in
  `docs/engineering/queryforge-reuse-plan.md`.

Completed Phase 1 slice:

- deterministic natural-language gift parser
- staff gift search API
- public gift search API with privacy-safe recipient output
- staff Gift Search page
- public sponsor signup gift search integration

Completed Phase 2 slice:

- `gift_reservation` migration and SQLAlchemy model
- active reservation guard for public sponsor verification
- public signup now creates reservations while email verification is pending
- public gift search and sponsor config hide actively reserved gifts
- public verification converts active reservations to committed sponsorship
  items
- staff commit/release APIs
- staff Gift Search commit drawer and release action

Completed Phase 3 slice:

- expanded wishlist item status workflow for gift operations
- staff operations aggregate API
- receive, wrap, mark ready, and exception transition APIs
- item event recording for operations transitions
- sponsor drop-off rollup when committed gifts are received
- staff Gift Operations page with status filters, search, row drawer, and
  workflow actions
- Gifts navigation now links to Search and Operations

Completed Phase 4 slice:

- enriched donation line inventory model and migration
- gift pool aggregate API
- donation and donation line intake APIs
- donation line update API
- match suggestion API using category, description, size, age, gender, and
  priority scoring
- assignment API that creates fulfillment rows, updates wishlist fulfillment
  state, updates inventory quantities/status, and records item events
- staff Gift Pool page with intake drawer, inventory table, match drawer, and
  assignment action
- Gifts navigation now includes Gift Pool

Completed Phase 5 slice:

- label print service
- print job create/get APIs
- label payloads with QR scan paths based on opaque label codes
- scan lookup API with audit event recording
- scan action API for receive, wrap, ready, distribute, exception, and reprint
- expanded scan event action enum migration
- operations print queue drawer with QR tag previews
- protected `/scan/gifts/:labelCode` staff scan page with workflow actions

## Objective

Deliver the gift workflow in incremental slices without blocking the existing
People, Sponsors, and public signup work.

The first usable outcome should be:

- staff can search open gifts
- public sponsors can search/filter gifts more effectively
- staff can commit, receive, wrap, tag, and distribute gifts
- donated inventory can be entered and matched to wishlist needs
- sponsor reminders can be enabled/disabled and sent from automation
- reporting can summarize operational readiness

## Current Assets

Already present:

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
- sponsor workspace
- public sponsor signup/verification
- campaign automation runtime
- campaign milestone/readiness configuration
- People workflow rollups

## Phase 1: Gift Search Foundation

### Goal

Create one backend gift search contract that staff and public sponsor flows can
use safely.

### Backend Tasks

1. Add `app/features/gifts/`
   - `api.py`
   - `public_api.py`
   - `service.py`
   - `search_parser.py`
   - `serializers.py`
   - `validation.py`

2. Add staff gift search endpoint
   - `GET /api/v1/campaigns/<campaign_id>/gifts/search`

3. Add public gift search endpoint
   - `GET /api/v1/public/campaigns/<public_slug>/gifts/search`

4. Add natural-language parser endpoint
   - staff: `POST /api/v1/campaigns/<campaign_id>/gifts/search/parse`
   - public: `POST /api/v1/public/campaigns/<public_slug>/gifts/search/parse`

5. Implement deterministic parser
   - age ranges
   - gender words
   - common gift categories
   - clothing/coat/toy/gift-card synonyms
   - size terms
   - cost phrases if present

6. Add result eligibility
   - staff sees all allowed campaign gifts
   - public sees only open, public-eligible gifts
   - public output hides sensitive recipient fields

### Frontend Tasks

1. Add staff route
   - `/campaigns/:campaignId/gifts/search`

2. Add public search/filter UI inside sponsor signup gift selection

3. Add shared search model helpers
   - filter chips
   - parsed query display
   - result presentation mapping

### Tests

- backend search filters
- public privacy filtering
- parser age/gender/category cases
- frontend search UI and public gift selection tests

### Exit Criteria

- staff can search open gifts with structured and NL input
- public sponsor gift selection supports search/filter chips
- no public result leaks restricted recipient/contact fields

## Phase 2: Reservation And Commitment Service

### Goal

Create a shared, transaction-safe reservation/commitment layer for staff and
public sponsor flows.

### Backend Tasks

1. Add migration for `gift_reservation`
   - `campaign_id`
   - `wishlist_item_id`
   - `sponsor_id`
   - `pending_sponsor_registration_id`
   - `reserved_by_user_id`
   - `reservation_source`
   - `status`
   - `expires_at`
   - timestamps

2. Add uniqueness guard for active reservation per wishlist item.

3. Add reservation service
   - create reservation
   - release reservation
   - expire reservations
   - convert reservation to sponsorship item

4. Refactor public sponsor pending registration to use reservations.

5. Add staff commit endpoint
   - `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/commit`

6. Add release endpoint
   - `POST /api/v1/campaigns/<campaign_id>/gifts/<wishlist_item_id>/release`

7. Record `item_event` for commit/release.

### Frontend Tasks

1. Add staff commit drawer.
2. Add reserve/commit actions to staff gift search.
3. Update public selected gift tray to show reservation expiry when relevant.

### Tests

- double reservation conflict
- double commit conflict
- reservation expiry
- public verification converts reservations to sponsorship items
- sponsor deletion still returns gifts to open/reservable inventory

### Exit Criteria

- staff and public flows use the same availability rules
- double-booking returns conflict, not server error
- expired public selections release inventory

## Phase 3: Gift Operations Workspace

### Goal

Build the staff operations screen for committed gifts and physical processing.

### Backend Tasks

1. Expand `wishlist_item.status`
   - add `RESERVED`
   - add `TAGGED`
   - add `READY_FOR_DISTRIBUTION`
   - add `DISTRIBUTED`
   - add `EXCEPTION`

2. Add operations aggregate endpoint
   - `GET /api/v1/campaigns/<campaign_id>/gifts/operations`

3. Add state transition endpoints
   - receive
   - wrap
   - mark ready
   - exception

4. Ensure transitions record `item_event`.

5. Update sponsor participation drop-off status when all committed sponsor
   gifts are received.

### Frontend Tasks

1. Add route
   - `/campaigns/:campaignId/gifts/operations`

2. Add campaign Gifts nav group
   - Search
   - Operations
   - Gift Pool
   - Reports

3. Build operations table
   - state filters
   - search
   - bulk selection
   - selected gift drawer

4. Add actions
   - receive
   - wrap
   - exception
   - open sponsor
   - open recipient

### Tests

- backend transition tests
- frontend state filter/action tests
- sponsor drop-off rollup tests

### Exit Criteria

- staff can move committed gifts through received/wrapped/exception states
- operations view reflects current state without manual recalculation

## Phase 4: Gift Pool And Inventory Matching

### Goal

Support donated goods that are not originally tied to wishlist items and match
them to recipient needs.

### Backend Tasks

1. Add donation-line inventory migration
   - campaign denormalization if needed
   - age range
   - gender fit
   - quantity available
   - quantity assigned
   - inventory status
   - gift condition
   - source label

2. Add gift pool endpoint
   - `GET /api/v1/campaigns/<campaign_id>/gift-pool`

3. Add donation create/update APIs.

4. Add donation-line create/update APIs.

5. Add match suggestions endpoint
   - `GET /api/v1/campaigns/<campaign_id>/donation-lines/<line_id>/matches`

6. Add assignment endpoint
   - `POST /api/v1/campaigns/<campaign_id>/donation-lines/<line_id>/assign`

7. Assignment creates `fulfillment` rows and updates quantities/statuses.

### Frontend Tasks

1. Add route
   - `/campaigns/:campaignId/gifts/pool`

2. Build inventory table.

3. Build donation intake drawer.

4. Build match suggestion drawer.

5. Add assign/split quantity flows.

### Tests

- inventory quantity accounting
- matching score cases
- assignment creates fulfillment
- frontend matching/assignment flow

### Exit Criteria

- staff can enter generic donated goods
- staff can match those goods to wishlist items
- matched inventory appears in gift operations/reporting

## Phase 5: Labels, QR, And Scan Flow

### Goal

Make gift tags printable and scannable for receiving, wrapping, and distribution.

### Backend Tasks

1. Add label print service.

2. Add print job endpoint
   - `POST /api/v1/campaigns/<campaign_id>/gift-labels/print-jobs`

3. Add PDF or HTML label rendering.

4. Add QR target generation using `label_code`.

5. Add scan lookup endpoint
   - `GET /api/v1/campaigns/<campaign_id>/gifts/scan/<label_code>`

6. Add scan action endpoint
   - `POST /api/v1/campaigns/<campaign_id>/gifts/scan/<label_code>/actions`

7. Record `scan_event` on every lookup/action.

### Frontend Tasks

1. Add print queue drawer in operations.

2. Add tag preview.

3. Add mobile-first scan route
   - `/scan/gifts/:labelCode`

4. Add scan action buttons.

### Tests

- print job creates label print rows
- QR payload does not expose raw recipient IDs
- scan lookup records event
- scan action updates gift state
- frontend scan action test

### Exit Criteria

- staff can print gift tags with QR codes
- scanning a tag opens the correct protected gift action screen
- scan actions update workflow state and audit history

## Phase 6: Gift Reminder Automation

Status: implemented.

### Goal

Let campaigns enable/disable automated sponsor reminders around due dates and
gift turn-in milestones.

### Backend Tasks

1. Add reminder-rule migration.
   - Implemented in `V031__Gift_Reminder_Rules.sql`.

2. Add gift reminder rule APIs
   - list/create/update
   - Implemented with preview and manual send endpoints under `/gift-reminder-rules`.

3. Add due reminder evaluation task.
   - Implemented as `bt.campaigns.evaluate_gift_reminders`.

4. Reuse campaign communication templates for message rendering.
   - Implemented with sponsor email templates and the existing campaign template renderer.

5. Resolve audiences:
   - committed but unreceived gifts
   - overdue gifts
   - received confirmations
   - Implemented by rule audience with sponsor/gift grouping.

6. Record `sponsor_interaction` rows for sends.
   - Implemented with matching `sponsor_reminder` rows for delivery tracking and duplicate suppression.

7. Add readiness checks for missing milestones/templates.
   - Implemented for enabled reminder rules with missing active templates or missing milestones.

### Frontend Tasks

1. Add reminder configuration to Campaign Studio or Gift Operations settings.
   - Implemented in the Gift Operations reminder settings drawer.

2. Add enable/disable toggles.
   - Implemented.

3. Add template selection.
   - Implemented.

4. Show next scheduled send preview.
   - Implemented as rule preview showing due state and matching sponsor/gift recipients.

### Tests

- rule validation
- due sponsor selection
- no reminder when gift already received
- sponsor interaction created
- readiness findings
- frontend configuration tests
  - Backend coverage added for validation paths, sponsor selection, duplicate suppression,
    received-gift suppression, sponsor interaction logging, and readiness findings.
  - Frontend coverage is currently build/typecheck coverage; add interaction tests when the
    Gift Operations page gets its dedicated test harness.

### Exit Criteria

- reminder rules can be configured per campaign
- automation sends only to relevant sponsors
- staff can see and disable reminder behavior

## Phase 7: Gift Reporting

### Goal

Expose campaign-level operational reporting for gifts, inventory, sponsors, and
distribution.

### Backend Tasks

1. Add gift report aggregate endpoint
   - `GET /api/v1/campaigns/<campaign_id>/gifts/reports`

2. Include:
   - gift pipeline counts
   - sponsorship coverage
   - overdue sponsor gifts
   - unmatched donated inventory
   - recipient groups missing gifts
   - exception list
   - distribution readiness

3. Add export endpoint if needed
   - CSV first

### Frontend Tasks

1. Add route
   - `/campaigns/:campaignId/gifts/reports`

2. Build dashboard cards and tables.

3. Add export action.

### Tests

- report aggregate counts
- overdue logic
- frontend report rendering

### Exit Criteria

- staff can answer operational readiness questions without manually inspecting
  People/Sponsor records

## Phase 8: Polish And Live Verification

### Goal

Verify the gift workflow against real user-controlled local processes and tune
the UX for repeated staff use.

### Tasks

1. Live browser pass:
   - staff gift search
   - public sponsor search/commit
   - receive/wrap/tag
   - scan/distribute
   - donated inventory match
   - reminders dry run

2. Accessibility pass:
   - keyboard row actions
   - form labels
   - scan screen on mobile width

3. Performance pass:
   - search indexes
   - result pagination
   - operations table size

4. Documentation:
   - update memory/current-state
   - update active workstream
   - add operator notes if needed

## Recommended First Build Slice

Start with Phase 1 and a small part of Phase 2:

1. backend staff gift search
2. public gift search/filter inside current sponsor signup
3. deterministic NL parser
4. staff search page
5. update current public gift selection to use search contract

Rationale:

- it gives immediate value
- it supports both staff and public sponsor paths
- it does not require changing every fulfillment state first
- it creates the contract later phases can reuse

## Migration Order

1. `gift_reservation`
2. wishlist item status enum expansion
3. donation line inventory enrichment
4. gift reminder rules
5. optional indexes for search/reporting

## Risk Areas

- MySQL enum changes need careful migration ordering.
- Public gift search must not leak recipient/contact details.
- Reservation/commit race handling must stay transactionally safe.
- Reminder automation needs suppression rules to avoid noisy sponsors.
- Scan routes must require authentication for staff operations.

## Verification Commands

Backend focused tests:

```bash
cd blessing-tree-api
./.venv/bin/python -m pytest tests/features/gifts tests/features/campaigns/test_sponsor_api.py
./.venv/bin/python -m ruff check app/features/gifts tests/features/gifts
```

Frontend focused tests:

```bash
cd blessing-tree-ui
npm test -- --run src/features/campaigns/ui/CampaignGiftSearch.test.tsx
npm test -- --run src/pages/PublicSponsorSignupPage.test.tsx
npm run build
```
