# RBAC Design

## Status

- Updated for user-access implementation planning on 2026-05-24
- Backend foundation exists: global app roles, campaign role assignments, capability constants, and campaign capability route guards
- Remaining work is mostly operational usability: role catalog refinement, Admin User Management workflows, frontend nav/route gating, and endpoint audit

## Summary

Blessing Tree should use a small RBAC framework built around:

- minimal global app roles
- campaign-scoped role assignments
- code-defined capability bundles

This is intentionally simpler than Query Forge. The system should support
feature-level access control quickly, but avoid a fully dynamic permission
administration model until there is real evidence that it is needed.

## Goals

- support feature access restrictions such as:
  - gift check-in only
  - donation entry only
  - coordinator access within one campaign
- keep campaign as the main authorization boundary
- keep backend authorization authoritative
- allow the frontend to hide routes, pages, and actions based on effective capabilities
- avoid early permission sprawl and admin-UI complexity

## Non-Goals

- no fully dynamic role builder in v1
- no permission editor UI in v1
- no generalized feature graph or role implication engine like Query Forge
- no multi-tenant or workspace RBAC model
- no object-level ACLs beyond campaign scope in v1

## Why Not Fully Dynamic RBAC Yet

Blessing Tree does need more than a single global role enum, but it does not
yet justify:

- role tables editable by admins
- permission tables editable by admins
- role-permission joins managed through UI
- versioning and migration rules for mutable permission keys
- guardrails for invalid custom role combinations

The likely operational roles are already understandable and stable enough to
define in code. That gives us predictable behavior and faster delivery with
less failure surface.

## Recommended Authorization Model

### 1. Global App Roles

Global roles should stay thin and represent application-wide authority only.

Recommended initial set:

- `APP_ADMIN`
- `APP_USER`

Notes:

- `APP_ADMIN` has full access across the system and can manage users, roles,
  and campaign assignments.
- `APP_USER` is simply an authenticated application user with no implied
  campaign authority.
- The current `app_user.role` enum should move toward this meaning, even if we
  keep temporary compatibility with `ADMIN`, `COORDINATOR`, and `VOLUNTEER`
  during migration.

### 2. Campaign-Scoped Role Assignments

Operational access should be granted per campaign.

Example:

- User A can be `CAMPAIGN_MANAGER` for campaign 2026
- the same user can be `GIFT_CHECKIN` for campaign 2025
- another user can be `DONATION_ENTRY` in one campaign and `RECIPIENT_EDITOR`
  in another

This fits the real operating model much better than broad global roles.

### 3. Capabilities

Capabilities should be explicit strings checked by backend policy code.

Example capability set:

- `campaign.view`
- `campaign.admin`
- `campaign.recipients.view`
- `campaign.recipients.edit`
- `campaign.donations.view`
- `campaign.donations.edit`
- `campaign.gifts.check_in`
- `campaign.gifts.wrap`
- `campaign.sponsors.view`
- `campaign.sponsors.manage`
- `campaign.reports.view`
- `campaign.pickups.manage`

Capabilities are not assigned directly to users in v1. They are granted by
roles defined in code.

## Role Catalog

Recommended campaign roles:

- `CAMPAIGN_MANAGER`
- `PEOPLE_MANAGER`
- `SPONSOR_MANAGER`
- `GIFT_OPERATIONS`
- `GIFT_SEARCH_USER`
- `REPORTS_VIEWER`
- `CAMPAIGN_VIEWER`

Compatibility note:

- The current code already has `RECIPIENT_COORDINATOR`, `DONATION_ENTRY`, `GIFT_CHECKIN`, and `VOLUNTEER_VIEWER`.
- We can either rename these in-place through a migration/UI label pass, or keep the stored keys and present friendlier labels in the UI.
- Prefer stable stored keys only if there is already production-like data depending on them. In current development mode, renaming to clearer role keys is acceptable.

Recommended capability bundles:

### `CAMPAIGN_MANAGER`

- all campaign-scoped capabilities

### `PEOPLE_MANAGER`

- `campaign.view`
- `campaign.recipients.view`
- `campaign.recipients.edit`
- `campaign.pickups.manage`
- `campaign.reports.view`

### `SPONSOR_MANAGER`

- `campaign.view`
- `campaign.sponsors.view`
- `campaign.sponsors.manage`
- `campaign.reports.view`

### `GIFT_OPERATIONS`

- `campaign.view`
- `campaign.gifts.search`
- `campaign.gifts.commit`
- `campaign.gifts.check_in`
- `campaign.gifts.wrap`
- `campaign.gifts.distribute`
- `campaign.gifts.pool.manage`
- `campaign.reports.view`

### `GIFT_SEARCH_USER`

- `campaign.view`
- `campaign.gifts.search`
- `campaign.gifts.commit`
- `campaign.sponsors.view`

### `REPORTS_VIEWER`

- `campaign.view`
- `campaign.reports.view`

### `CAMPAIGN_VIEWER`

- `campaign.view`

### Optional Future `DONATION_ENTRY`

Keep this as a narrow role only if donation entry becomes materially separate from gift pool operations.

- `campaign.view`
- `campaign.donations.view`
- `campaign.donations.edit`

## Multiple Roles Per Campaign

The system should allow multiple campaign role assignments per user.

Reasoning:

- avoids fake combined roles like `DONATION_ENTRY_AND_CHECKIN`
- keeps roles narrowly defined
- allows clean growth as operational needs become more specific

This means authorization should resolve effective capabilities as the union of
all active role assignments for `(user_id, campaign_id)`.

## Data Model

### Keep Existing `app_user`

Current model:

- `app_user.role`

Direction:

- treat it as a coarse global role field for now
- later migrate it toward app-level values only

### Add `campaign_user_role`

Recommended table:

- `id`
- `campaign_id`
- `user_id`
- `role_key`
- `is_active`
- `created_at`
- `updated_at`

Recommended constraints:

- foreign key to `campaign.id`
- foreign key to `app_user.id`
- unique constraint on `(campaign_id, user_id, role_key)`
- index on `(campaign_id, user_id)`
- index on `(campaign_id, role_key)`

The `role_key` should be a string or enum storing values like
`CAMPAIGN_MANAGER`, `DONATION_ENTRY`, `GIFT_CHECKIN`.

## Authorization Resolution Rules

1. If user is not authenticated: deny
2. If user is not active: deny
3. If user has global `APP_ADMIN`: allow
4. Otherwise resolve active campaign role assignments for the requested campaign
5. Expand those roles into capabilities using code-defined bundles
6. Allow only if requested capability is present

## Backend Design

### Policy Layer

Add a small authorization service responsible for:

- `is_app_admin(user)`
- `get_campaign_role_keys(user_id, campaign_id)`
- `get_campaign_capabilities(user_id, campaign_id)`
- `user_has_campaign_capability(user_id, campaign_id, capability)`

This should stay explicit and small. No Valkey cache is needed initially.

### Route Guards

Add route/decorator helpers such as:

- `require_authenticated_user`
- `require_app_admin`
- `require_campaign_capability(capability, campaign_id_arg=...)`

Campaign ID should be read from:

- path params when available
- request body only when unavoidable

Path-param scope is preferred because it keeps authorization easier to reason
about.

### API Response Shape

For authenticated bootstrap or user-profile endpoints, the backend should be
able to return:

- global role
- campaign assignments
- effective capabilities for the current campaign, if a campaign context is
  selected

We do not need a full “all permissions for all campaigns” payload on every
response in v1.

## Frontend Design

Frontend authorization should be advisory only. It improves UX, but does not
replace backend checks.

Frontend should use effective capabilities for:

- route gating
- nav visibility
- disabling or hiding buttons/forms
- page-specific guard components

Navigation should be capability-based, not role-name-based.

Example mapping:

- Campaign Studio: `campaign.admin` for editing settings/rules; `campaign.view` for read-only view
- People: `campaign.recipients.view`; edit actions require `campaign.recipients.edit`
- Sponsors: `campaign.sponsors.view`; mutating sponsor actions require `campaign.sponsors.manage`
- Gift Search: `campaign.gifts.search`
- Gift commit/reserve actions: `campaign.gifts.commit`
- Gift Operations/Scan: `campaign.gifts.check_in`, `campaign.gifts.wrap`, `campaign.gifts.distribute`
- Gift Pool: `campaign.gifts.pool.manage`
- Reports: `campaign.reports.view`
- Admin: global `APP_ADMIN`

The frontend should not hardcode business access decisions independently from
backend capability names.

## Recommended Capability Naming Rules

- lowercase dot-separated strings
- noun area first, action second
- stable, explicit names

Examples:

- `campaign.recipients.edit`
- `campaign.donations.edit`
- `campaign.gifts.check_in`

Avoid vague keys like:

- `manage_recipients`
- `write`
- `staff_access`

## Migration Strategy

### Phase 1

- keep existing global role enum working
- add campaign role assignment table
- implement capability bundles in code

### Phase 2

- enforce capability checks on new campaign APIs
- expose capability data to frontend

### Phase 3

- normalize existing global roles into true app-level roles only
- remove accidental business meaning from global roles

## Tradeoffs

### Benefits

- enough flexibility for real operational roles
- far less complexity than fully dynamic RBAC
- clearer auditability
- easier backend enforcement
- simpler frontend gating

### Costs

- changing role bundles requires code deploys
- no admin-defined custom roles in v1
- eventual migration may be needed if role customization becomes a product need

## Future Upgrade Path

If Blessing Tree later needs custom role creation, this design can evolve by:

1. keeping capability strings stable
2. moving role definitions from code into database tables
3. keeping the same authorization service interface

That means this design is not a dead end. It is a smaller first version of a
system that can grow later if real operational pressure appears.
