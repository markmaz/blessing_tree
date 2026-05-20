# Campaign API Design

## Status

- Proposed and accepted for implementation on 2026-05-20

## Summary

Campaign is the top-level operating container for Blessing Tree.

It is the primary boundary for:

- campaign lifecycle
- user access
- reporting scope
- recipient, wishlist, donation, sponsor, gift, and pickup operations

The API should support:

- normal CRUD-style campaign management
- campaign-scoped RBAC
- campaign access/context bootstrap for the frontend
- AI-assisted campaign creation from a prompt
- a future "Campaign Studio" screen that presents the campaign as a structured operational surface rather than a plain form

This design intentionally uses:

- many campaign memberships per user
- one selected active campaign in frontend state
- path-first campaign scope in APIs
- archival instead of normal deletes

## Locked Decisions

### Campaign Cardinality

- Multiple campaigns per year are allowed.
- `year` is not a unique business key.

### Naming

- `name` is independently editable.
- `year` is still stored and remains useful for grouping, filtering, and reporting.

### Campaign Selection Model

- Users may have access to multiple campaigns.
- The UI should still maintain one selected active campaign at a time.

### Lifecycle Rules

- `DRAFT`
  - setup/configuration state
  - editable by app admin or campaign manager
- `ACTIVE`
  - live operating state
  - full normal operations allowed based on capability
- `CLOSED`
  - normal users become read-only unless a specific capability is allowed later
  - campaign managers and app admins may still perform cleanup edits
- `ARCHIVED`
  - read-only for normal operations
  - app admins may still change metadata if necessary

### Delete Policy

- No normal hard delete endpoint.
- Standard removal path is `ARCHIVED`.
- Hard delete is reserved for a future super-admin-only workflow for recovery from accidental creation.

### Campaign Creation Defaults

- The creating user should automatically receive `CAMPAIGN_MANAGER` for the new campaign unless they are already operating as `APP_ADMIN`.

### Access Payload Shape

- `GET /campaigns` includes lightweight access information inline.
- `GET /campaigns/<campaign_id>/access` returns the fuller access shape for the current user in that campaign.

### Dashboard Summary

Campaign summary should include at least:

- recipient group count
- recipient count
- wishlist count
- wishlist item count
- donation count
- sponsorship count
- sponsorship item count
- fulfillment count
- pickup count

### Status Transitions

Allowed default transitions:

- `DRAFT -> ACTIVE`
- `ACTIVE -> CLOSED`
- `CLOSED -> ARCHIVED`

App-admin-only exceptions:

- `ACTIVE -> DRAFT`
- `CLOSED -> ACTIVE`
- `ARCHIVED -> CLOSED`
- `ARCHIVED -> ACTIVE`
- `ARCHIVED -> DRAFT`

## Resource Model

Base campaign fields:

- `id`
- `name`
- `year`
- `start_date`
- `end_date`
- `status`
- `description`
- `created_at`
- `updated_at`

Recommended near-term metadata additions:

- `intake_notes`
- `operational_notes`

Recommended later-only additions:

- `default_pickup_instructions`
- `default_sponsor_message`
- `campaign_settings` JSON column if configuration surface becomes too broad for flat fields

## Capabilities

Campaign endpoints should use existing RBAC conventions and these campaign capabilities:

- `campaign.view`
- `campaign.admin`
- `campaign.reports.view`

Interpretation:

- `campaign.view`
  - can see campaign detail and summary
- `campaign.admin`
  - can edit campaign metadata, lifecycle, and operational structure
- `campaign.reports.view`
  - can consume summary/report surfaces

App-level role:

- `APP_ADMIN`
  - bypasses campaign capability checks

Campaign role defaults:

- `CAMPAIGN_MANAGER`
  - receives all campaign-scoped capabilities

## REST API

Base path:

- `/api/v1/campaigns`

### 1. List Campaigns

- `GET /api/v1/campaigns`

Purpose:

- return campaigns visible to the current user
- support campaign switcher and landing screens

Access:

- authenticated user

Behavior:

- `APP_ADMIN` sees all campaigns
- other users see campaigns where they have at least one active assignment

Query params:

- `status`
- `year`
- `search`
- `include_archived` default `false`

Response:

```json
[
  {
    "id": "9fd3a9d2-1f1f-4c78-82d0-f0c1dc7f1d7d",
    "name": "Blessing Tree 2026",
    "year": 2026,
    "status": "ACTIVE",
    "start_date": "2026-11-01",
    "end_date": "2026-12-31",
    "user_access": {
      "global_app_role": "APP_USER",
      "role_keys": ["DONATION_ENTRY"],
      "capabilities": [
        "campaign.view",
        "campaign.donations.view",
        "campaign.donations.edit"
      ]
    }
  }
]
```

### 2. Campaign Detail

- `GET /api/v1/campaigns/<campaign_id>`

Purpose:

- campaign metadata/detail

Access:

- `APP_ADMIN`, or
- any user with at least one active assignment for that campaign, or
- any user with `campaign.view`

Response:

```json
{
  "id": "9fd3a9d2-1f1f-4c78-82d0-f0c1dc7f1d7d",
  "name": "Blessing Tree 2026",
  "year": 2026,
  "description": "Main 2026 Christmas campaign.",
  "status": "ACTIVE",
  "start_date": "2026-11-01",
  "end_date": "2026-12-31",
  "created_at": "2026-05-20T14:00:00Z",
  "updated_at": "2026-05-20T14:00:00Z"
}
```

### 3. Create Campaign

- `POST /api/v1/campaigns`

Purpose:

- create a campaign from structured input

Access:

- `APP_ADMIN`

Request:

```json
{
  "name": "Blessing Tree 2026",
  "year": 2026,
  "description": "Main 2026 Christmas campaign.",
  "start_date": "2026-11-01",
  "end_date": "2026-12-31",
  "status": "DRAFT"
}
```

Behavior:

- validates lifecycle and date ordering
- creates campaign
- creates creator `CAMPAIGN_MANAGER` assignment unless creator is operating only through global app-admin authority and assignment creation is intentionally skipped

Response:

- `201 Created`
- return full campaign payload

### 4. Update Campaign

- `PATCH /api/v1/campaigns/<campaign_id>`

Purpose:

- edit metadata or move lifecycle state

Access:

- `APP_ADMIN`, or
- `campaign.admin`

Patchable fields:

- `name`
- `year`
- `description`
- `start_date`
- `end_date`
- `status`

Rules:

- reject illegal status transitions
- reject write attempts that violate lifecycle restrictions
- `ARCHIVED` changes are app-admin-only by default

Response:

- updated campaign payload

### 5. Campaign Access

- `GET /api/v1/campaigns/<campaign_id>/access`

Purpose:

- return current user's effective access in one campaign
- power navigation, page guards, button guards, and campaign switcher context

Access:

- same as campaign detail

Response:

```json
{
  "campaign_id": "9fd3a9d2-1f1f-4c78-82d0-f0c1dc7f1d7d",
  "global_app_role": "APP_USER",
  "role_keys": ["GIFT_CHECKIN", "DONATION_ENTRY"],
  "capabilities": [
    "campaign.view",
    "campaign.gifts.check_in",
    "campaign.gifts.wrap",
    "campaign.donations.view",
    "campaign.donations.edit"
  ]
}
```

### 6. Campaign Summary

- `GET /api/v1/campaigns/<campaign_id>/summary`

Purpose:

- lightweight operational metrics for dashboard/studio overview

Access:

- `campaign.view`

Response:

```json
{
  "campaign_id": "9fd3a9d2-1f1f-4c78-82d0-f0c1dc7f1d7d",
  "counts": {
    "recipient_groups": 128,
    "recipients": 314,
    "wishlists": 301,
    "wishlist_items": 978,
    "donations": 54,
    "sponsorships": 202,
    "sponsorship_items": 611,
    "fulfillments": 188,
    "pickups": 61
  }
}
```

### 7. Campaign Hard Delete

- No normal endpoint in v1.

Reserved future endpoint:

- `DELETE /api/v1/campaigns/<campaign_id>`

Access:

- future super-admin-only

Behavior:

- must not exist in normal admin UI
- must require explicit confirmation flow

## AI-Assisted Campaign Creation

AI is explicitly allowed for this product surface.

The campaign API should support a structured AI-assisted creation path in addition to normal manual creation.

### Goals

- allow staff to create an initial campaign draft from a natural-language prompt
- keep AI output advisory until the user accepts or edits it
- avoid direct blind writes from a raw model response into production records
- keep AI drafts transient by default unless the user creates a real campaign

### Recommended Flow

1. User enters a prompt such as:
   - "Create a 2027 blessing tree campaign for the north campus with gift intake starting in October, family registration in November, and pickup weekends in December."
2. Backend generates a structured draft.
3. Frontend presents the draft in Campaign Studio.
4. User edits/accepts sections.
5. User explicitly saves draft or creates campaign.

### Endpoints

#### Generate Campaign Draft From Prompt

- `POST /api/v1/campaigns/ai/drafts`

Access:

- `APP_ADMIN`

Request:

```json
{
  "prompt": "Create a 2027 blessing tree campaign for the north campus with gift intake starting in October and pickups in December."
}
```

Response:

```json
{
  "draft": {
    "name": "North Campus Blessing Tree 2027",
    "year": 2027,
    "description": "Draft campaign generated from prompt.",
    "status": "DRAFT",
    "start_date": "2027-10-01",
    "end_date": "2027-12-31",
    "suggested_sections": {
      "intake": {
        "notes": "Begin family registration in early November."
      },
      "donations": {
        "notes": "Enable donation entry and sponsor coordination."
      },
      "pickup": {
        "notes": "Plan pickup weekends in December."
      }
    }
  },
  "warnings": [
    "Dates were inferred from prompt text and should be reviewed before saving."
  ]
}
```

#### Create Campaign From AI Draft

- `POST /api/v1/campaigns/ai/drafts/create`

Access:

- `APP_ADMIN`

Behavior:

- validates the accepted draft payload
- creates the real campaign record
- creates creator `CAMPAIGN_MANAGER` assignment as normal

### AI Guardrails

- AI must not auto-publish directly to `ACTIVE`
- AI-created campaigns should default to `DRAFT`
- inferred dates/sections must be visible to the user before save
- AI should not create assignments or user permissions automatically beyond the standard creator-manager rule
- AI drafts should remain transient by default and may be cached in frontend local storage for in-progress editing

## Campaign Studio

The user wants a campaign surface more like Query Forge Workflow Studio than a plain CRUD page.

That is the right direction.

### Studio Concept

Campaign Studio should present the campaign as an operational composition surface with:

- left rail for campaign areas
- main canvas/work area for selected section
- right-side inspector/drawer for section detail and edits
- AI assistant panel for prompt-driven draft/build help

This should borrow the interaction model of Query Forge FlowForge Studio, not the workflow graph itself.

Meaning:

- rail-driven navigation
- persistent selected context
- section-level drawers
- AI-assisted drafting
- overview plus detail in one screen

### Studio Sections

Recommended left-rail sections:

- Overview
- Access
- Recipients
- Wishlists
- Donations
- Sponsors
- Gifts
- Pickups
- Reports
- Settings

### Overview Surface

The default studio overview should show:

- campaign metadata card
- lifecycle/status card
- summary counts
- readiness/checklist section
- recent activity section
- quick actions

### Section Drawers / Inspectors

Examples:

- Settings drawer
  - campaign metadata
  - dates
  - lifecycle transitions
- Access drawer
  - role assignments
  - capability preview
- Donations drawer
  - donation configuration notes
- Pickup drawer
  - pickup readiness notes

### AI Assistant Panel

Campaign Studio should include an AI side panel similar in spirit to FlowForge’s AI assistant panel.

Suggested uses:

- create campaign draft from prompt
- refine campaign name/description
- suggest dates/checklists
- suggest setup gaps
- propose operational milestones

Suggested prompt starters:

- "Create a 2027 campaign for our east campus."
- "Add a family intake plan and pickup schedule."
- "Suggest a readiness checklist for opening this campaign."

### Non-Goals For V1 Studio

- no graph canvas
- no drag-and-drop workflow builder
- no campaign automation authoring in this screen yet

Campaign Studio should be a structured operational cockpit, not a workflow editor.

## Backend Implementation Order

1. Add campaign feature package in backend:
   - routes
   - service
   - serializers/schemas
2. Implement:
   - `GET /campaigns`
   - `GET /campaigns/<campaign_id>`
   - `GET /campaigns/<campaign_id>/access`
   - `GET /campaigns/<campaign_id>/summary`
3. Apply RBAC decorators to those endpoints
4. Add:
   - `POST /campaigns`
   - `PATCH /campaigns/<campaign_id>`
5. Add AI draft endpoints
6. Build frontend campaign switcher + Campaign Studio shell

## Recommended Frontend Route Shape

- `/campaigns`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/studio`
- `/campaigns/:campaignId/settings`
- `/campaigns/:campaignId/access`

Recommendation:

- make `/campaigns/:campaignId/studio` the main operator-facing route
- use the simpler detail/settings/access routes for direct navigation and deep-linking

## Resolved Follow-Ups

- `description` should be added immediately to the DB schema.
- Campaign summary should include sponsorship-item and fulfillment counts in v1.
- AI-generated campaign drafts should remain transient until the user creates a real campaign, with frontend local storage as an acceptable cache for in-progress drafts.
