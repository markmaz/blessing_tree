# Campaign Recipient Implementation Plan

Last updated: 2026-05-21

## Status

- Planned
- Implementation has not started yet

This plan follows:

- `docs/engineering/campaign-recipient-design.md`

## Objective

Implement the campaign recipient domain in a way that supports:

- one unified recipient model for both children and nursing-home adults
- campaign-scoped intake containers for households and care facilities
- contacts that are operational but not gift recipients
- one wishlist per recipient
- a campaign-aware `People` workspace in the frontend
- a safe transition from the older family-oriented placeholder surface

## Delivery Strategy

Do not attempt to replace the entire recipient domain in one jump.

The project already has:

- initial recipient schema in `V001__Initial_DB.sql`
- ORM models for `recipient_group`, `group_contact`, `recipient`, `wishlist`, and `wishlist_item`
- campaign summary counts that already depend on those tables
- a placeholder frontend `Families` area

The right path is:

1. refine the schema and model semantics first
2. add recipient-specific APIs
3. build the `People` workspace
4. then connect communications, reporting, and fulfillment to the refined model

## Phase 1: Schema Refinement Foundation

### Goal

Refine the current schema without breaking the downstream gift pipeline.

### Tasks

1. Update `recipient_group` semantics
   - evolve `group_type`
   - move from `HOUSEHOLD | INSTITUTION`
   - toward `HOUSEHOLD | CARE_FACILITY`
   - add `status`
   - add `external_reference`

2. Update `group_contact`
   - add `relationship_label`
   - add `can_pick_up`
   - add `is_emergency_contact`

3. Update `recipient`
   - add `recipient_kind`
   - add `program_type`
   - add recipient-level fields needed for nursing-home adults:
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
   - map `SENIOR -> recipient_kind=ADULT, program_type=NURSING_HOME`
   - map child family rows to `program_type=CHILD_FAMILY`

### Deliverables

- migration for recipient refinement
- updated ORM models
- compatibility/backfill rules for existing data

## Phase 2: Domain Model And Validation Cutover

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

4. Update campaign summary/count logic only if needed
   - summary counts should remain stable through the refactor

### Deliverables

- refined model layer
- validation rules
- stable summary compatibility

## Phase 3: Recipient Feature Package And APIs

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

### Goal

Replace the old family-only placeholder with the new campaign-scoped `People`
workspace.

### Tasks

1. Replace UI framing
   - change nav label from `Families` to `People`
   - make route campaign-aware:
     - `/campaigns/:campaignId/people`

2. Build summary cards
   - `Groups`
   - `People`
   - `Wishlists`
   - `Open Items`

3. Build `Households & Facilities` section
   - searchable/sortable table
   - create actions:
     - `Add Household`
     - `Add Facility`
   - row click opens group drawer

4. Build `People` section
   - searchable/sortable table
   - create action:
     - `Add Person`
   - row click opens person drawer

5. Build drawers
   - group drawer
   - contact editing inside group drawer
   - person drawer
   - wishlist editor launched from person drawer

6. Build workflow-aware create flows
   - family/household intake path
   - facility/nursing-home intake path

### Deliverables

- new `People` page
- campaign-aware routing
- automated frontend coverage for the new workspace

## Phase 5: Wishlist Workflow And Sponsorship Alignment

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

### Goal

Make the recipient domain usable as a communications audience source.

### Tasks

1. Extend audience resolution
   - household parent/guardian contacts
   - facility staff/social-worker contacts
   - direct recipient contact where appropriate

2. Add audience filters by:
   - `group_type`
   - `program_type`
   - `contact_role`
   - wishlist readiness/status later as needed

3. Update communications builder metadata and scheduling flows
   - audience labels should use People-friendly language

### Deliverables

- recipient-aware audience resolution
- communications integration with the refined recipient model

## Phase 7: Reporting And Cleanup

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
3. add/edit wishlist items
4. verify People workspace row/drawer behavior

## Recommended Build Order

The safest build order is:

1. Phase 1: schema refinement
2. Phase 2: model/validation cutover
3. Phase 3: APIs
4. Phase 4: People workspace
5. Phase 5: wishlist/fulfillment alignment
6. Phase 6: communications audience integration
7. Phase 7: reporting cleanup

## Recommendation

Start with backend refinement first.

Do not begin with the frontend rename from `Families` to `People` until the
recipient APIs and refined schema are in place.

The first implementation slice should be:

- migration
- updated models
- backend recipient feature package

Then the `People` workspace can land on a stable backend contract instead of
another placeholder surface.
