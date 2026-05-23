# Campaign Sponsor Workspace Implementation Plan

Last updated: 2026-05-22

## Status

- Planned
- Implementation has not started yet
- Sponsor domain foundation already exists in the backend through:
  - `sponsor`
  - `sponsorship`
  - `sponsorship_item`
  - `sponsor_interaction`
  - `sponsor_reminder`
- The next step is to turn that foundation into a campaign-scoped sponsor workspace plus a public self-registration flow

This plan follows:

- `docs/engineering/campaign-sponsor-workspace-design.md`

## Objective

Implement sponsor operations in a way that supports:

- campaign-scoped sponsor CRUD and search
- reuse of a global sponsor identity across campaigns
- campaign participation through `sponsorship`
- communication logging for both manual outreach and mass campaign sends
- public sponsor self-registration with email verification
- public gift selection with a soft limit of `3` whole items
- pending registration expiry after `24 hours`
- Campaign Studio management of public signup, QR, and flyer generation
- sponsor reporting aligned with campaign operations

## Delivery Strategy

Do not try to build the entire sponsor workflow in one jump.

The project already has:

- sponsor and sponsorship tables
- recipient/wishlist data that can be sponsored
- campaign communications infrastructure
- campaign milestone and readiness infrastructure
- a proven `People` workspace pattern that can inform sponsor UI without copying its hierarchy

The delivery path should be:

1. refine and normalize the sponsor data model
2. expose campaign-scoped sponsor APIs and workspace payloads
3. build staff-facing sponsor intake/directory flows
4. build the communication log
5. build the public signup + verification + pending registration flow
6. connect gift reservation and campaign communications
7. add QR/flyer and sponsor reporting

## Phase 1: Sponsor Domain Refinement

Status: planned

### Goal

Refine the existing sponsor tables so they support real campaign operations and public intake without overloading the current minimal shape.

### Tasks

1. Refine `sponsor`
   - add `first_name`
   - add `last_name`
   - add address fields:
     - `address_line1`
     - `address_line2`
     - `city`
     - `state`
     - `postal_code`
   - add `source`
   - add `source_detail`
   - add `self_registered_at`
   - add `last_contacted_at`
   - add `do_not_contact`

2. Refine `sponsorship`
   - add `sponsor_code`
   - add `interest_status`
   - add `drop_off_status`
   - add `drop_off_due_at`
   - add `drop_off_completed_at`
   - add `self_registered`

3. Refine `sponsor_interaction`
   - add `origin_type`
   - add `related_schedule_id`
   - add `related_delivery_attempt_id`
   - add `external_message_id`

4. Add sponsor normalization rules
   - lowercase email
   - normalize phone
   - uppercase state
   - normalize postal code
   - derive `display_name` from first/last when appropriate

### Deliverables

- sponsor refinement migration
- updated ORM models
- normalization helpers and constants

## Phase 2: Pending Public Registration Foundation

Status: planned

### Goal

Create an explicit pending-registration layer so public self-registration does not write incomplete state into final sponsorship rows.

### Tasks

1. Add `pending_sponsor_registration` table
   - `id`
   - `campaign_id`
   - `email`
   - normalized sponsor identity snapshot
   - selected gift references
   - verification token
   - verification sent timestamp
   - expires at
   - status
   - created from IP / audit metadata if desired

2. Add status model
   - `PENDING`
   - `VERIFIED`
   - `EXPIRED`
   - `CANCELLED`

3. Add expiry handling
   - `24 hour` expiration rule
   - background cleanup or on-read expiry enforcement
   - release selected gifts when expired

4. Add verification token behavior
   - secure token generation
   - one-time verification
   - post-verification transition into final sponsor/sponsorship state

### Deliverables

- pending sponsor registration model
- migration
- service layer for create, verify, expire, and promote

## Phase 3: Staff-Facing Sponsor Workspace APIs

Status: planned

### Goal

Expose campaign-scoped sponsor CRUD and workspace APIs for the staff-facing sponsor section.

### Tasks

1. Create sponsor feature package
   - `app/features/sponsors/`

2. Add sponsor workspace endpoint
   - `GET /api/v1/campaigns/<campaign_id>/sponsor-workspace`

3. Add sponsor CRUD endpoints
   - `GET /api/v1/campaigns/<campaign_id>/sponsors`
   - `POST /api/v1/campaigns/<campaign_id>/sponsors`
   - `GET /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>`
   - `PATCH /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>`
   - `DELETE /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>`

4. Add sponsor matching/reuse logic
   - exact normalized email match
   - exact normalized phone as secondary support
   - no automatic fuzzy merge in v1

5. Add workspace payload
   - summary counts
   - sponsor rows
   - filter metadata
   - sponsored-item summaries
   - last-contact summaries

### Deliverables

- sponsor feature package
- serializers
- validation
- sponsor workspace API contract

## Phase 4: Staff-Facing Sponsor UI

Status: planned

### Goal

Build the campaign-scoped sponsor workspace in the frontend.

### Tasks

1. Add sponsor routes
   - `/campaigns/:campaignId/sponsors`
   - `/campaigns/:campaignId/sponsors/intake`
   - `/campaigns/:campaignId/sponsors/directory`
   - `/campaigns/:campaignId/sponsors/reports`

2. Add left-nav child structure
   - `Sponsors`
     - `Intake`
     - `Directory`
     - `Reports`

3. Build `Intake`
   - `Add Sponsor`
   - public signup link preview
   - QR/flyer actions later
   - recent sponsor entries

4. Build `Directory`
   - searchable sponsor table
   - sponsor drawer
   - sponsored gifts table
   - quick delete/edit actions with confirmation

5. Build sponsor drawer sections
   - Sponsor Details
   - Campaign Participation
   - Sponsored Gifts
   - Communication Log
   - Metadata

### Deliverables

- sponsor frontend API layer
- sponsor workspace pages
- sponsor drawer UI

## Phase 5: Sponsor Communication Log

Status: planned

### Goal

Make `sponsor_interaction` visible and manageable in the sponsor workspace.

### Tasks

1. Add interaction endpoints
   - `GET /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions`
   - `POST /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions`
   - `PATCH /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions/<interaction_id>`
   - `DELETE /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions/<interaction_id>`

2. Add manual interaction types
   - call
   - email
   - text
   - in-person

3. Add sponsor log UI
   - table view
   - interaction modal for create/edit
   - follow-up support

4. Respect log edit rules
   - manual interactions editable
   - mass-send entries read-only

### Deliverables

- communication log APIs
- sponsor drawer log UI

## Phase 6: Public Sponsor Signup APIs

Status: planned

### Goal

Expose the public sponsor signup flow with campaign-level enable/disable behavior.

### Tasks

1. Add public sponsor config endpoint
   - `GET /api/v1/public/campaigns/<public_slug>/sponsor-config`

2. Add public pending-registration create endpoint
   - `POST /api/v1/public/campaigns/<public_slug>/sponsors`

3. Enforce public-flow rules
   - signup enabled
   - campaign milestone window open
   - gift deadline present
   - gift count soft limit of `3`
   - whole-item only selection

4. Add email verification endpoint
   - `POST /api/v1/public/campaigns/<public_slug>/sponsors/verify`
   - or tokenized `GET`/`POST` route as implementation prefers

5. Add abuse protection
   - rate limiting
   - honeypot
   - server-side validation

### Deliverables

- public sponsor config route
- pending registration create/verify flow
- abuse-protection plumbing

## Phase 7: Reservation Finalization And Gift Claiming

Status: planned

### Goal

Convert verified public selections into real sponsorship records and reserved gifts.

### Tasks

1. On verification
   - match or create sponsor
   - update sponsor fields
   - create or update campaign sponsorship
   - create `sponsorship_item` rows

2. Reserve gifts
   - no partial quantities
   - reserve whole items only
   - ensure availability at verification time

3. Add re-check logic
   - if one or more items are no longer available at verification time, return a clear resolution path

4. Add audit logging
   - pending registration created
   - verification completed
   - sponsor reused or created
   - gifts reserved

### Deliverables

- verified reservation finalization
- sponsorship item creation rules
- audit trail

## Phase 8: Campaign Studio Integration

Status: planned

### Goal

Manage public sponsor signup and flyer generation from Campaign Studio.

### Tasks

1. Add sponsor signup controls to Campaign Studio
   - enabled/disabled
   - public message
   - public link preview
   - QR preview

2. Add milestone support
   - `sponsor_registration_start`
   - `sponsor_registration_end`

3. Add readiness integration
   - block public sponsor signup if sponsor registration milestones are missing
   - block if gift deadline is missing

4. Add sponsor flyer generation action
   - one standard template
   - QR code image
   - printable PDF output

### Deliverables

- Campaign Studio sponsor signup settings
- readiness checks
- QR flyer generation

## Phase 9: Mass Communication Log Integration

Status: planned

### Goal

Automatically log mass sponsor communications into the sponsor communication log.

### Tasks

1. Extend communication dispatch integration
   - create `sponsor_interaction` rows for resolved sponsor recipients

2. Mark interaction metadata
   - `origin_type = CAMPAIGN_COMMUNICATION`
   - schedule linkage
   - delivery metadata where available

3. Keep entries read-only in the UI

### Deliverables

- automatic sponsor log integration for campaign communications

## Phase 10: Sponsor Reports

Status: planned

### Goal

Expose a sponsor reporting surface aligned to campaign operations.

### Tasks

1. Add sponsor report metrics
   - total sponsors
   - active sponsorships
   - sponsored items
   - open sponsor needs
   - self-registered vs staff-entered
   - unverified pending registrations

2. Add report sections
   - outreach funnel
   - contactability gaps
   - drop-off readiness
   - recent communication activity

3. Add direct navigation
   - `Open Intake`
   - `Open Directory`
   - `Open Campaign Studio`

### Deliverables

- sponsor reports page

## Recommended First Build Slice

The best first implementation slice is:

1. Phase 1: sponsor domain refinement
2. Phase 2: pending registration foundation
3. Phase 3: sponsor workspace APIs
4. Phase 4: staff-facing sponsor intake/directory UI

That gets the operational sponsor surface in place before public self-registration and QR/flyer work begin.
