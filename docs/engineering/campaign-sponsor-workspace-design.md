# Campaign Sponsor Workspace Design

## Purpose

This document defines the sponsor domain and workspace for Blessing Tree.

Goals:

- manage sponsors in a campaign-scoped workspace
- allow staff to create and maintain sponsors without unnecessary complexity
- allow sponsors to add themselves through a public campaign-specific page
- support printable flyers with QR codes that route sponsors into the public intake flow
- keep a communication log for each sponsor
- record both manual contact attempts and mass campaign communications
- align the sponsor flow with the existing `People` workspace patterns where useful, but keep the data model simpler because sponsors do not have a family-style hierarchy

This is a workflow and API design document. It does not prescribe every implementation detail, but it should be specific enough to guide backend and frontend work.

## Current State

The backend already contains foundational sponsor models:

- `sponsor`
- `sponsorship`
- `sponsorship_item`
- `sponsor_interaction`
- `sponsor_reminder`

What exists today:

- sponsors are modeled globally
- campaign linkage happens through `sponsorship`
- sponsor interactions are already campaign-scoped
- communications infrastructure already understands a sponsor audience in the campaign communications layer

What does not exist yet:

- sponsor CRUD APIs and workspace
- public sponsor self-registration page
- sponsor communication log UI
- automatic interaction entries for mass campaign sends
- flyer / QR workflow

## Design Principles

1. Keep sponsor operations campaign-aware at the workspace level.
2. Reuse the existing global sponsor record rather than creating a duplicate per campaign.
3. Keep the sponsor intake model flatter than the recipient model.
4. Treat self-service sponsor intake as a controlled campaign entry point, not a general public signup.
5. Make the communication log the source of truth for sponsor outreach history.
6. Prefer deterministic QR/flyer generation over ad hoc staff instructions.

## Domain Model

## Sponsor Identity

Keep `sponsor` as the durable person / household / organization-level sponsor identity.

Current core fields:

- `display_name`
- `organization_name`
- `email`
- `phone`
- `preferred_contact`
- `notes`
- `is_active`

Recommended additions:

- `address_line1`
- `address_line2`
- `city`
- `state`
- `postal_code`
- `first_name`
- `last_name`
- `source`
- `source_detail`
- `self_registered_at`
- `last_contacted_at`
- `do_not_contact`

Rationale:

- a sponsor may participate across multiple campaigns
- the reusable identity belongs on `sponsor`
- address matters for thank-you mail, pickup, delivery, and future segmentation
- storing parsed first/last names improves communications and sorting

Recommended normalized field meanings:

- `display_name`
  - canonical UI name
- `organization_name`
  - optional organization / church / business
- `source`
  - `STAFF_ENTRY`, `PUBLIC_QR`, `PUBLIC_LINK`, `IMPORT`, `OTHER`
- `source_detail`
  - freeform operational detail if needed

## Campaign Participation

Keep `sponsorship` as the campaign-scoped connection between a sponsor and a campaign.

Current core fields:

- `campaign_id`
- `sponsor_id`
- `status`
- `notes`

Recommended additions:

- `sponsor_code`
- `interest_status`
- `drop_off_status`
- `drop_off_due_at`
- `drop_off_completed_at`
- `self_registered`
- `self_registered_token` or `public_access_token`
- `public_slug`

Recommended enums:

- `status`
  - `ACTIVE`
  - `COMPLETE`
  - `CANCELLED`
- `interest_status`
  - `NEW`
  - `CONTACTED`
  - `RESPONDED`
  - `COMMITTED`
  - `DECLINED`
- `drop_off_status`
  - `NOT_STARTED`
  - `SCHEDULED`
  - `RECEIVED`
  - `LATE`

Rationale:

- the global sponsor identity is not enough for campaign operations
- campaign staff need campaign-specific progress and notes
- public self-registration should create or update a campaign participation record, not just a sponsor identity

## Sponsored Gifts

Keep the downstream relationship:

- `sponsorship`
- `sponsorship_item`
- `wishlist_item`

This remains the actual fulfillment link:

- one sponsor can sponsor multiple items
- one campaign can have many sponsors
- sponsorship status on wishlist items should continue to flow from this layer

## Sponsor Communication Log

Keep `sponsor_interaction` as the central communication log.

Current fields already align well:

- `campaign_id`
- `sponsor_id`
- `channel`
- `direction`
- `subject`
- `outcome`
- `notes`
- `occurred_at`
- `created_by_user_id`
- `follow_up_at`
- `related_sponsorship_id`

Recommended additions:

- `origin_type`
  - `MANUAL`
  - `CAMPAIGN_COMMUNICATION`
  - `PUBLIC_SIGNUP`
  - `SYSTEM`
- `related_schedule_id`
- `related_delivery_attempt_id`
- `external_message_id`

Rationale:

- this lets one log hold:
  - phone calls
  - one-off emails
  - text messages
  - sponsor self-signup
  - mass campaign sends

### Mass Communications

When a campaign communication is sent to a sponsor audience, create `sponsor_interaction` rows for each resolved sponsor recipient.

Minimum logging behavior:

- `channel` from the schedule/delivery
- `direction = OUTBOUND`
- `subject` from the communication template or final rendered subject
- `occurred_at` from send time
- `origin_type = CAMPAIGN_COMMUNICATION`
- `related_schedule_id` populated
- `external_message_id` populated when available
- `outcome`
  - `COMPLETED` for accepted send
  - `BOUNCED` when delivery later fails
  - or a new delivery-specific mapping if needed later

This should make the sponsor log complete enough to answer:

- who contacted this sponsor
- when
- how
- whether it was manual or mass communication

## Public Sponsor Intake

The public sponsor signup flow should be managed from Campaign Studio.

Recommended placement:

- `Campaign Studio > Communications` for sponsor-facing message/template alignment
- `Campaign Studio > Settings` or a dedicated `Sponsor Signup` panel for:
  - public signup enabled/disabled
  - public sponsor message
  - public link preview
  - QR code preview
  - flyer generation

This keeps sponsor self-registration tied to the active campaign operations surface rather than hiding it in a separate admin-only area.

## Public Entry Point

Each campaign should expose a public sponsor entry URL, for example:

- `/public/campaigns/:campaignPublicSlug/sponsor`

This route is:

- public
- campaign-specific
- intended for QR codes and flyers

The campaign should hold a public-facing slug or token distinct from its internal UUID.

Recommended campaign fields:

- `public_sponsor_slug`
- `public_sponsor_enabled`
- `public_sponsor_message`

Rationale:

- avoid exposing raw internal campaign ids in printed materials
- allow staff to disable public sponsor intake for a campaign

## Public Sponsor Form

The public sponsor form should collect:

- first name
- last name
- display name or household name if needed
- organization name optional
- email
- phone
- preferred contact
- address optional at first launch, but recommended
- interest note optional
- consent / acknowledgment checkbox if legally needed

Initial public flow decision:

- public sponsors should be able to choose gifts to sponsor during self-registration
- the first implementation should collect sponsor information first, then move into gift selection against the current campaign's available unsponsored items
- gift selection should be all-or-none, not partial quantity
- the public flow should enforce a soft limit of `3` selected gifts per sponsor submission

Suggested behavior:

- if sponsor already exists by normalized email, reuse that sponsor record
- else if sponsor already exists by normalized phone, reuse with caution
- else create a new sponsor
- create or reuse a campaign `sponsorship` record
- mark `self_registered = true`
- create a `sponsor_interaction` record with:
  - `origin_type = PUBLIC_SIGNUP`
  - `direction = INBOUND`
  - `channel = EMAIL` or `OTHER` equivalent mapping if needed
  - `subject = "Sponsor self-registration"`

### Duplicate Handling

The public flow should avoid duplicate sponsor records as much as possible.

Recommended matching priority:

1. exact normalized email
2. exact normalized phone
3. fuzzy name + email domain review only, not automatic merge

If an existing sponsor is matched:

- update missing fields conservatively
- do not blindly overwrite richer existing staff-entered data

Confirmed direction:

- sponsors should not need to re-enter their identity for every campaign
- reuse the existing sponsor record when matched
- update the sponsor identity when the public user changes their own contact details
- create or update the campaign participation record for the current campaign rather than creating duplicate sponsor identities

### Verification and Reservation Flow

Public sponsor registration should be verified by email before gifts are actually reserved.

Implementation note:

- use an explicit `pending_sponsor_registration` record or equivalent pending-public-registration table
- do not force incomplete public registrations directly into final `sponsorship` rows before verification completes

Recommended flow:

1. sponsor enters information
2. sponsor selects up to `3` whole gifts
3. system creates a pending public registration record
4. system sends a verification email
5. sponsor clicks the verification link
6. system re-checks gift availability
7. selected gifts move to `RESERVED`
8. sponsor participation and communication log are finalized

Important rule:

- unverified sponsor registrations expire after `24 hours`
- expired pending selections should release automatically and return those gifts to the available pool

Rationale:

- verified email becomes the trusted public identifier
- gift inventory is not locked by fake or mistyped email submissions
- expiration keeps the public pool healthy if a sponsor never completes verification
- keeping pending public state separate from final sponsorship state simplifies verification, expiry cleanup, audit logging, and reservation release

### Public-Flow Abuse Protection

The public sponsor flow should include:

- rate limiting
- honeypot or equivalent bot trap
- server-side validation
- verified-email gating before final reservation

Primary matching key:

- normalized verified email

Secondary matching key:

- normalized phone for staff review and enrichment, not automatic public identity resolution by itself

## QR Code and Flyer Flow

## Campaign Sponsor Flyer

Each campaign should be able to generate a printable sponsor flyer PDF that includes:

- campaign name
- short sponsor invitation copy
- public sponsor URL
- QR code pointing to that URL
- optional season theme or supporting message
- optional campaign contact information

Recommended output:

- letter-size PDF
- one-page flyer first

Recommended system behavior:

- staff choose `Generate Sponsor Flyer` from Campaign Studio
- backend builds the public URL from campaign settings
- backend generates a QR code image
- frontend or backend renders the flyer template
- PDF is downloadable and printable

This does not need to be a fully general document builder in v1.

### Design Direction

The flyer should be campaign-specific and repeatable.

Recommended fields:

- title
  - `Become a Blessing Tree Sponsor`
- campaign label
- short explanation
- QR code
- typed URL under QR code
- simple help/contact block

## Workspace Information Architecture

Sponsors should follow a similar overall pattern to `People`, but flatter.

Recommended campaign-scoped routes:

- `/campaigns/:campaignId/sponsors`
- `/campaigns/:campaignId/sponsors/intake`
- `/campaigns/:campaignId/sponsors/directory`
- `/campaigns/:campaignId/sponsors/reports`

Related Campaign Studio capability:

- public sponsor signup configuration and flyer generation should be reachable from Campaign Studio as campaign tooling, even if the sponsor CRUD workspace itself remains its own section

Recommended left-nav structure:

- `Sponsors`
  - `Intake`
  - `Directory`
  - `Reports`

### Intake

Purpose:

- create sponsors quickly
- generate public signup/flyer assets
- monitor public sponsor entry availability

Top actions:

- `Add Sponsor`
- `Open Public Signup`
- `Generate QR Flyer`

Secondary panel:

- recent sponsors
- public signup URL
- QR preview

Campaign Studio should expose the same public signup controls so campaign managers can manage sponsor signup from the operational campaign surface without leaving Studio.

### Directory

Purpose:

- search and maintain sponsors
- review contact details
- see sponsorship status
- review communication history

Directory row columns:

- Sponsor
- Organization
- Preferred Contact
- Contact Info
- Status
- Sponsored Items
- Last Contact
- Last Updated

Expandable row or drawer content:

- campaign participation summary
- sponsored wishlist items
- communication log preview
- quick actions

### Reports

Purpose:

- campaign sponsor health
- outreach completion
- self-registration adoption
- drop-off readiness

Suggested stat cards:

- Total Sponsors
- Active Sponsorships
- Sponsored Items
- Open Sponsor Needs

Suggested report sections:

- outreach funnel
- self-registration vs staff-entered mix
- contactability gaps
- drop-off status
- high-priority unsponsored items

## Sponsor Drawer

Because there is no family-style hierarchy, the sponsor drawer should be simpler than the People drawer.

Recommended sections:

1. Sponsor Details
2. Campaign Participation
3. Sponsored Gifts
4. Communication Log
5. Metadata

Behavior:

- on create, `Sponsor Details` starts expanded
- on edit, `Sponsor Details` may start collapsed if campaign staff mostly revisit sponsors for outreach logging or item assignment

### Sponsor Details

- first name
- last name
- display name
- organization
- email
- phone
- preferred contact
- address
- notes

### Campaign Participation

- status
- interest status
- drop-off status
- sponsor code
- campaign notes

### Sponsored Gifts

Table-driven, similar to gift tables elsewhere:

- recipient
- item
- qty committed
- fulfillment state
- pickup/drop-off state if relevant

### Communication Log

Table-driven:

- occurred at
- channel
- direction
- subject
- outcome
- origin
- follow-up
- created by

Actions:

- `Log Call`
- `Log Email`
- `Log Text`
- `Log In-Person`

Each opens a focused modal, not an always-open large embedded form.

## Permissions

Use existing RBAC capability shape:

- `campaign.sponsors.view`
- `campaign.sponsors.manage`

Recommended behavior:

- `view`
  - can see sponsor directory, sponsor details, sponsored items, and communication log
- `manage`
  - can create/edit/delete sponsors, assign sponsorships, log interactions, generate flyers, and enable/disable public sponsor intake

## API Shape

## Workspace and CRUD

Recommended endpoints:

- `GET /api/v1/campaigns/<campaign_id>/sponsor-workspace`
- `GET|POST /api/v1/campaigns/<campaign_id>/sponsors`
- `GET|PATCH|DELETE /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>`
- `GET|POST /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions`
- `PATCH|DELETE /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/interactions/<interaction_id>`
- `GET|POST /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/sponsorship-items`
- `PATCH|DELETE /api/v1/campaigns/<campaign_id>/sponsors/<sponsor_id>/sponsorship-items/<sponsorship_item_id>`

Recommended workspace response:

- summary counts
- sponsor rows
- filter metadata
- unsponsored-item summary for assignment workflows

## Public Sponsor Intake

Recommended public endpoints:

- `GET /api/v1/public/campaigns/<public_slug>/sponsor-config`
- `POST /api/v1/public/campaigns/<public_slug>/sponsors`

Config payload should provide:

- campaign display name
- public sponsor enabled state
- public message
- minimal theme data if desired

POST should:

- validate public sponsor intake is enabled
- create or match sponsor
- create or match campaign sponsorship record
- log the self-registration interaction
- return a simple thank-you payload

## Flyer / QR

Recommended endpoints:

- `GET /api/v1/campaigns/<campaign_id>/sponsors/public-link`
- `POST /api/v1/campaigns/<campaign_id>/sponsors/flyer`

`public-link` returns:

- URL
- QR image URL or data
- enabled state

`flyer` returns:

- generated PDF artifact

## Communications Integration

Sponsor workspace should integrate with campaign communications in two directions.

1. Sponsor audience resolution already exists and should remain reusable.
2. Mass sponsor sends should append `sponsor_interaction` rows.

This should be automatic, not manual cleanup work.

Campaign Studio should also be able to surface:

- sponsor self-signup link
- QR flyer generation
- sponsor-facing template suggestions
- sponsor audience schedules

## Campaign Milestone Integration

Sponsor self-registration should be governed by campaign milestones.

Recommended milestone fields:

- `sponsor_registration_start`
- `sponsor_registration_end`

Behavior:

- the public sponsor signup page should only accept registrations when the current date/time is between those milestones
- Campaign Studio should show the public sponsor flow as inactive before start and closed after end
- QR flyers and public links can still exist outside that window, but the public page should show a clear registration closed or not-yet-open message

Readiness integration:

- missing sponsor-registration start/end milestones should block public sponsor signup activation
- if public sponsor signup is enabled but those milestones are missing, Campaign Readiness should show a blocker
- missing gift deadline milestones should also block the public “what happens next” messaging contract

Post-registration messaging:

- the confirmation screen and confirmation email should use the campaign gift deadline milestone to explain next steps
- if the gift deadline milestone is missing, the campaign should fail readiness for public sponsor signup

## Data Normalization

The sponsor workspace should follow the same data-quality rules already established in `People`.

Normalize on save:

- email lowercased and trimmed
- phone normalized to one display/storage format
- state uppercased
- postal code normalized
- names trimmed and display-cased as appropriate

Derived values:

- `display_name` from first + last when not manually provided
- `last_contacted_at` from the latest interaction

## Non-Goals For Initial Sponsor Workspace

Not required in v1:

- full sponsor portal with login
- self-service item selection against live inventory
- complex public preference center
- generalized document designer for flyers
- automated merge engine for fuzzy duplicate matches

## Recommended Delivery Order

1. Sponsor workspace backend and CRUD APIs
2. Sponsor intake + directory UI
3. Sponsor communication log UI and logging APIs
4. Public sponsor self-registration flow with gift selection
5. Email verification, pending registration expiry, and reservation finalization
6. Campaign communication integration into the interaction log
7. QR flyer generation with one standard template
8. Sponsor reporting surface

## Open Questions

Resolved for the initial implementation:

1. Public sponsor self-registration should allow gift selection during the same flow.
2. Returning sponsors should reuse and update the same sponsor identity; campaign participation should be created or updated for the current campaign.
3. Mass-communication log entries should be system-generated and read-only in normal operations.
4. Sponsor flyer generation should use one standard template first.
5. Public gift selections should not reserve inventory until the sponsor verifies their email.
6. Unverified sponsor registrations should expire after `24 hours`.
7. Public sponsor gift selection should be whole-item only with a soft limit of `3` gifts.
8. Campaign milestones should control sponsor registration opening/closing and the sponsor confirmation/deadline messaging.

Implementation assumption to keep momentum:

- the first public sponsor flow will collect sponsor information before showing available gifts, instead of allowing anonymous browsing/claiming first
