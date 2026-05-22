# Campaign Recipient Implementation Plan

Last updated: 2026-05-22

## Status

- In progress
- Phases 1 through 6 are implemented
- The next planned phase is reporting and cleanup on top of the refined People
  workspace and communications audience model

This plan follows:

- `docs/engineering/campaign-recipient-design.md`

## Objective

Implement the campaign recipient domain in a way that supports:

- one unified recipient model for children, facility-based adults, and
  partner-program adults
- campaign-scoped intake containers for households, care facilities, and
  partner programs
- contacts that are operational but not gift recipients
- one wishlist per recipient
- a campaign-aware `People` workspace in the frontend
- a safe transition from the older family-oriented placeholder surface
- recipient-level address, phone, and email data for adult contexts where it
  is appropriate

## Delivery Strategy

Do not attempt to replace the entire recipient domain in one jump.

The project already has:

- initial recipient schema in `V001__Initial_DB.sql`
- ORM models for `recipient_group`, `group_contact`, `recipient`, `wishlist`, and `wishlist_item`
- campaign summary counts that already depend on those tables
- a campaign-aware `People` section with `Intake` and `Directory` child views

The delivery path has been:

1. refine the schema and model semantics first
2. add recipient-specific APIs
3. build the `People` workspace
4. then connect communications, reporting, and fulfillment to the refined model

## Phase 1: Schema Refinement Foundation

Status: implemented

### Goal

Refine the current schema without breaking the downstream gift pipeline.

### Tasks

1. Update `recipient_group` semantics
   - evolve `group_type`
   - move from `HOUSEHOLD | INSTITUTION`
   - toward `HOUSEHOLD | CARE_FACILITY | PARTNER_PROGRAM`
   - add `status`
   - add `external_reference`

2. Update `group_contact`
   - add `relationship_label`
   - add `can_pick_up`
   - add `is_emergency_contact`

3. Update `recipient`
   - add `recipient_kind`
   - add `program_type`
   - add recipient-level fields needed for adult programs:
     - `address_line1`
     - `address_line2`
     - `city`
     - `state`
     - `postal_code`
     - `direct_email`
     - `direct_phone`
     - `facility_room`
     - `mobility_notes`
     - `birth_year` or later `date_of_birth`

4. Update `wishlist`
   - add `wishlist_status`
   - add `intake_method`
   - add `submitted_at`
   - add `intake_completed_by_contact_id`

5. Update `wishlist_item`
   - add `item_type`
   - add `recipient_note`
   - add `do_not_substitute_reason`

6. Create migration plan for current enums/data
   - map `INSTITUTION -> CARE_FACILITY`
   - map `SENIOR -> recipient_kind=ADULT, program_type=SENIOR_FACILITY`
   - map child family rows to `program_type=CHILD_FAMILY`

### Deliverables

- migration for recipient refinement
- updated ORM models
- compatibility/backfill rules for existing data

## Phase 2: Domain Model And Validation Cutover

Status: implemented

### Goal

Make the refined schema the authoritative backend model.

### Tasks

1. Update SQLAlchemy models
   - `recipient_group.py`
   - `group_contact.py`
   - `recipient.py`
   - `wishlist.py`
   - `wishlist_item.py`

2. Add recipient domain constants
   - `group_type`
   - `recipient_kind`
   - `program_type`
   - `wishlist_status`
   - `item_type`

3. Add validation helpers
   - enforce legal program/group combinations
   - enforce legal recipient-kind/program combinations
   - enforce program-specific required fields where needed
   - keep child direct-contact fields hidden/not required for household flows
   - allow optional direct-contact/address fields for facility adults
   - support direct-contact/address fields for partner-program adults

4. Update campaign summary/count logic only if needed
   - summary counts should remain stable through the refactor

### Deliverables

- refined model layer
- validation rules
- stable summary compatibility

## Phase 3: Recipient Feature Package And APIs

Status: implemented

### Goal

Expose a real campaign-scoped recipient domain API.

### Tasks

1. Create feature package
   - `app/features/recipients/`

2. Add group APIs
   - `GET /api/v1/campaigns/<campaign_id>/recipient-groups`
   - `POST /api/v1/campaigns/<campaign_id>/recipient-groups`
   - `GET /api/v1/campaigns/<campaign_id>/recipient-groups/<group_id>`
   - `PATCH /api/v1/campaigns/<campaign_id>/recipient-groups/<group_id>`

3. Add group contact APIs
   - `POST /api/v1/campaigns/<campaign_id>/recipient-groups/<group_id>/contacts`
   - `PATCH /api/v1/campaigns/<campaign_id>/recipient-groups/<group_id>/contacts/<contact_id>`
   - `DELETE /api/v1/campaigns/<campaign_id>/recipient-groups/<group_id>/contacts/<contact_id>`

4. Add recipient APIs
   - `GET /api/v1/campaigns/<campaign_id>/recipients`
   - `POST /api/v1/campaigns/<campaign_id>/recipients`
   - `GET /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>`
   - `PATCH /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>`

5. Add wishlist APIs
   - `GET /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>/wishlist`
   - `PUT /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>/wishlist`
   - `POST /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>/wishlist/items`
   - `PATCH /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>/wishlist/items/<item_id>`
   - `DELETE /api/v1/campaigns/<campaign_id>/recipients/<recipient_id>/wishlist/items/<item_id>`

6. Add aggregate People workspace payload
   - summary counts
   - group rows
   - recipient rows
   - filter options

### Deliverables

- recipient feature package
- serializers and validation layer
- People workspace API contract

## Phase 4: Campaign-Aware People Workspace

Status: implemented

### Goal

Replace the old family-only placeholder with the new campaign-scoped `People`
workspace.

### Tasks

1. Replace UI framing
   - change nav label from `Families` to `People`
   - make routes campaign-aware:
     - `/campaigns/:campaignId/people/intake`
     - `/campaigns/:campaignId/people/directory`

2. Build `Intake` child page
   - primary actions:
     - `Add Family`
     - `Add Facility`
     - `Add Partner Program`
   - keep users in context to add children/residents and their wishlists

3. Build `Directory` child page
   - summary cards:
     - `Groups`
     - `People`
     - `Wishlists`
     - `Open Items`
   - searchable/sortable `Households, Facilities & Programs` table
   - searchable/sortable `People` table

4. Build drawers
   - group drawer
   - contact editing inside group drawer
   - person drawer
   - wishlist editor launched from person drawer

5. Build workflow-aware conditional forms
   - child intake hides non-applicable direct-contact fields
   - facility-resident intake shows resident-specific fields and allows optional
     direct recipient address/phone/email
   - partner-program adult intake shows recipient address/phone/email fields
     prominently
   - group drawer keeps linked children/residents visible during intake

### Deliverables

- new `People` page
- campaign-aware routing
- automated frontend coverage for the new workspace

## Phase 5: Wishlist Workflow And Sponsorship Alignment

Status: implemented

### Goal

Connect the refined recipient model cleanly to gift workflows.

### Tasks

1. Ensure wishlist editor supports required intake data
   - item type
   - priority
   - substitute preferences
   - notes

2. Validate downstream compatibility
   - sponsorships
   - donations
   - fulfillment
   - label printing
   - pickup

3. Update any fulfillment-facing serializers as needed
   - labels should show the right recipient/group display data
   - pickup should use authorized contacts correctly

### Deliverables

- recipient-to-fulfillment compatibility verification
- any required serializer or reporting updates

## Phase 6: Communications Audience Integration

Status: implemented

### Goal

Make the recipient domain usable as a communications audience source.

### Tasks

1. Extend audience resolution
   - household parent/guardian contacts
   - facility staff/social-worker contacts
   - partner-program coordinator contacts
   - direct recipient contact where appropriate

2. Add audience filters by:
   - `group_type`
   - `program_type`
   - `contact_role`
   - wishlist readiness/status later as needed

3. Update communications builder metadata and scheduling flows
   - audience labels should use People-friendly language
   - partner-program contacts and direct recipient channels should remain
     distinct address books

### Deliverables

- recipient-aware audience resolution
- communications integration with the refined recipient model

## Phase 7: Reporting And Cleanup

Status: next

### Goal

Finish the cutover and remove older family-oriented assumptions.

### Tasks

1. Update reporting terminology
   - move from family-only naming to People/recipient-group naming where needed

2. Remove deprecated compatibility paths
   - old enum assumptions
   - stale placeholder family code
   - any redundant mapping logic no longer needed

3. Update docs and canonical references
   - backend README
   - frontend README
   - roadmap/current state

### Deliverables

- cleaned-up naming
- retired compatibility code
- updated docs

## API/Authorization Notes

Recommended capabilities:

- `campaign.recipients.view`
- `campaign.recipients.edit`

Interpretation:

- `campaign.recipients.view`
  - view People workspace, groups, recipients, and wishlists
- `campaign.recipients.edit`
  - create/update groups, contacts, recipients, and wishlist data

These capabilities already fit the current RBAC direction and should be used
instead of introducing a second permissions model.

## Testing Strategy

### Backend

- migration verification
- model validation tests
- recipient/group/contact API tests
- wishlist API tests
- program/group compatibility tests

### Frontend

- unit tests for People workspace tables and drawers
- wishlist editor tests
- campaign-aware route/state tests

### Browser E2E

Add at least:

1. create household with parent and child
2. create facility with staff contact and adult recipient
3. create partner program with coordinator contact and adult recipients
4. add/edit wishlist items
5. verify People workspace row/drawer behavior

## Recommended Build Order

The original safest build order was:

1. Phase 1: schema refinement
2. Phase 2: model/validation cutover
3. Phase 3: APIs
4. Phase 4: People workspace
5. Phase 5: wishlist/fulfillment alignment
6. Phase 6: communications audience integration
7. Phase 7: reporting cleanup

## Recommendation

Backend refinement was the right first move, and that is now done through the
People workspace and wishlist/fulfillment alignment phases.

The current next slice should be communications audience integration on top of
the implemented recipient foundation, with special attention to:

- household parent/guardian contacts
- facility coordination contacts
- partner-program coordination contacts
- direct adult recipient channels where appropriate
