# RBAC Implementation Plan

Last updated: 2026-05-24

## Status

- Foundation is partially implemented.
- Existing backend pieces:
  - `campaign_user_role` persistence
  - `AuthorizationService`
  - campaign capability constants and role bundles
  - `require_app_admin`
  - `require_campaign_capability`
  - Campaign Studio access payload with effective capabilities
- Missing product pieces:
  - user-management UI for campaign access
  - admin APIs for assigning campaign roles from User Management
  - refined role/capability catalog for Sponsors and Gift Workflow
  - frontend route/nav/action gating based on campaign capabilities
  - endpoint audit for every campaign-scoped API

This plan follows `docs/engineering/rbac-design.md`.

## Objective

Give administrators a practical way to limit app users to the parts of a campaign they should operate.

Global app roles stay simple:

- `APP_ADMIN`: app-wide authority and user/access administration
- `APP_USER`: authenticated user with no campaign authority unless assigned

Operational access is campaign-scoped.

## Design Principles

- Backend authorization is authoritative.
- Frontend gating improves usability but never replaces API checks.
- Campaign is the main security boundary.
- Users can have multiple campaign roles in the same campaign.
- Role definitions remain code-defined for now; no dynamic permission builder in this phase.
- Admin User Management should be the main place to manage a user's campaign access.

## Target Role Catalog

### `CAMPAIGN_MANAGER`

Full campaign setup and operations access.

Capabilities:

- all campaign-scoped capabilities

### `PEOPLE_MANAGER`

Recipient, household, organization, wishlist, and pickup coordination.

Capabilities:

- `campaign.view`
- `campaign.recipients.view`
- `campaign.recipients.edit`
- `campaign.pickups.manage`
- `campaign.reports.view`

### `SPONSOR_MANAGER`

Sponsor intake, sponsor directory, public signup follow-up, and sponsor reports.

Capabilities:

- `campaign.view`
- `campaign.sponsors.view`
- `campaign.sponsors.manage`
- `campaign.reports.view`

### `GIFT_OPERATIONS`

Gift search, commit, receive, wrap, tag, pool, scan, and distribution operations.

Capabilities:

- `campaign.view`
- `campaign.gifts.search`
- `campaign.gifts.commit`
- `campaign.gifts.check_in`
- `campaign.gifts.wrap`
- `campaign.gifts.distribute`
- `campaign.gifts.pool.manage`
- `campaign.reports.view`

### `GIFT_SEARCH_USER`

Limited staff/self-help role for finding and committing available gifts.

Capabilities:

- `campaign.view`
- `campaign.gifts.search`
- `campaign.gifts.commit`
- `campaign.sponsors.view`

### `REPORTS_VIEWER`

Read-only campaign reporting.

Capabilities:

- `campaign.view`
- `campaign.reports.view`

### `CAMPAIGN_VIEWER`

Basic campaign read-only access.

Capabilities:

- `campaign.view`

## Current Compatibility Map

Current code role keys can map to the target catalog this way:

| Current key | Target key | Notes |
| --- | --- | --- |
| `CAMPAIGN_MANAGER` | `CAMPAIGN_MANAGER` | Keep |
| `RECIPIENT_COORDINATOR` | `PEOPLE_MANAGER` | Rename or relabel |
| `GIFT_CHECKIN` | `GIFT_OPERATIONS` | Rename or expand capabilities |
| `VOLUNTEER_VIEWER` | `CAMPAIGN_VIEWER` | Rename or relabel |
| `DONATION_ENTRY` | Optional future role | Keep only if donations stay separate from gift pool |

Because the project is in active development, prefer renaming keys now if there is no meaningful production data dependency.

## Capability Changes Needed

Current capabilities are close but too coarse for the gift workflow. Add:

- `campaign.gifts.search`
- `campaign.gifts.commit`
- `campaign.gifts.distribute`
- `campaign.gifts.pool.manage`

Keep existing:

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

## Phase 1: Role Catalog And Capability Matrix

### Goal

Make backend role definitions match the roles users will actually see in Admin User Management.

### Backend Tasks

1. Update RBAC constants.
   - Add new gift capabilities.
   - Add target role keys.
   - Update `CAMPAIGN_ROLE_CAPABILITIES`.
   - Update `CAMPAIGN_ROLE_CATALOG` labels and descriptions.

2. Decide whether to migrate stored role keys.
   - If renaming, add SQL migration to update existing `campaign_user_role.role_key`.
   - If not renaming, keep stored keys and change labels only.

3. Update tests that assert role catalog contents.

### Deliverables

- updated role/capability constants
- optional migration for role key renames
- role catalog tests

## Phase 2: Admin Campaign Access APIs

### Goal

Allow app admins to list and change a user's campaign-scoped roles from User Management.

### Backend API Shape

Add:

- `GET /api/v1/admin/users/<user_id>/campaign-access`
- `PUT /api/v1/admin/users/<user_id>/campaign-access`

Recommended `GET` response:

```json
{
  "user_id": "...",
  "campaigns": [
    {
      "campaign": {
        "id": "...",
        "name": "Blessing Tree 2026",
        "year": 2026,
        "status": "ACTIVE"
      },
      "role_keys": ["SPONSOR_MANAGER"],
      "capabilities": [
        "campaign.view",
        "campaign.sponsors.view",
        "campaign.sponsors.manage",
        "campaign.reports.view"
      ]
    }
  ],
  "role_catalog": [
    {
      "role_key": "SPONSOR_MANAGER",
      "label": "Sponsor Manager",
      "description": "...",
      "capabilities": ["..."]
    }
  ]
}
```

Recommended `PUT` payload:

```json
{
  "assignments": [
    {
      "campaign_id": "...",
      "role_keys": ["SPONSOR_MANAGER", "REPORTS_VIEWER"]
    }
  ]
}
```

Semantics:

- `PUT` replaces the selected user's campaign access set.
- Unknown campaigns return `400`.
- Unknown role keys return `400`.
- Existing assignments not in the payload are deactivated or deleted.
- Multiple roles per campaign are allowed.
- Only `APP_ADMIN` can call these endpoints in this phase.

### Backend Tasks

1. Add admin service methods:
   - list user campaign access
   - replace user campaign access
   - compute effective capabilities per assignment row

2. Add serializers.

3. Add endpoints under Admin API.

4. Add tests:
   - app admin can list campaign access
   - app admin can replace campaign access
   - non-admin is forbidden
   - invalid role key returns `400`
   - invalid campaign ID returns `400`
   - multiple roles union capabilities correctly

### Deliverables

- admin campaign-access API
- service and validation
- tests

## Phase 3: Admin User Management UI

### Goal

Make campaign access manageable from the existing user drawer.

### Frontend Tasks

1. Extend admin API client:
   - `fetchAdminUserCampaignAccess(userId)`
   - `updateAdminUserCampaignAccess(userId, assignments)`

2. Extend admin types:
   - campaign access row
   - campaign role catalog item
   - update payload

3. Update `AdminUserDetailDrawer`.
   - Add a `Campaign Access` section.
   - Show one row per campaign.
   - Use multi-select or checkbox group for role keys.
   - Show effective capabilities in subdued text or expandable detail.
   - Include clear empty state: "No campaign access assigned."

4. Save workflow:
   - Save global app access separately from campaign access.
   - Show clear success/error messages.
   - Disable save while pending.

5. Add tests:
   - drawer loads and displays campaign access
   - assigning/removing role calls API payload correctly
   - role labels render from catalog

### Deliverables

- campaign access section in User Management drawer
- admin API client updates
- frontend tests

## Phase 4: Frontend Capability Gating

### Goal

Hide navigation and block routes for users who do not have the required campaign capability.

### Frontend Tasks

1. Add capability helpers.

Recommended helpers:

- `hasCampaignCapability(access, capability)`
- `hasAnyCampaignCapability(access, capabilities)`
- `canViewPeople(access)`
- `canManagePeople(access)`
- `canViewSponsors(access)`
- `canManageSponsors(access)`
- `canUseGiftSearch(access)`
- `canUseGiftOperations(access)`
- `canViewReports(access)`

2. Update campaign context or page loaders so selected campaign access is available to layout/navigation.

3. Update sidebar visibility.

Suggested mapping:

| UI area | Required capability |
| --- | --- |
| Campaigns list | authenticated user; row visibility should be campaign assignment aware |
| Campaign Studio read | `campaign.view` |
| Campaign Studio settings/rules edits | `campaign.admin` |
| People nav | `campaign.recipients.view` |
| People edit actions | `campaign.recipients.edit` |
| Sponsors nav | `campaign.sponsors.view` |
| Sponsors edit/actions | `campaign.sponsors.manage` |
| Gift Search | `campaign.gifts.search` |
| Commit gift | `campaign.gifts.commit` |
| Gift Operations/Scan | `campaign.gifts.check_in` or `campaign.gifts.wrap` or `campaign.gifts.distribute` |
| Gift Pool | `campaign.gifts.pool.manage` |
| Gift Status | `campaign.reports.view` |
| People Reports | `campaign.reports.view` |
| Sponsor Reports | `campaign.reports.view` |
| Admin | global `APP_ADMIN` |

4. Add route guard component.

Example behavior:

- If no selected campaign: redirect to campaign selection.
- If missing capability: show a simple forbidden page with current campaign name and required access message.
- Do not silently redirect to an unrelated screen.

5. Add tests:
   - sidebar hides People for users without recipient view
   - sidebar hides Sponsors for users without sponsor view
   - Gift Status remains visible for reports viewers
   - direct route access shows forbidden state

### Deliverables

- capability helpers
- sidebar gating
- route guards
- tests

## Phase 5: Backend Endpoint Audit

### Goal

Make every campaign-scoped endpoint enforce the least broad capability that matches the action.

### Audit Targets

People:

- list/read: `campaign.recipients.view`
- create/update/delete groups, contacts, recipients, wishlist items: `campaign.recipients.edit`

Sponsors:

- list/read/report: `campaign.sponsors.view` or `campaign.reports.view`
- create/update/delete sponsor records: `campaign.sponsors.manage`
- public sponsor endpoints remain public but campaign readiness still governs availability

Gifts:

- search: `campaign.gifts.search`
- staff commit/release: `campaign.gifts.commit`
- receive: `campaign.gifts.check_in`
- wrap/tag/ready: `campaign.gifts.wrap`
- distribute/pickup/manual status transitions: `campaign.gifts.distribute`
- gift pool intake/assignment: `campaign.gifts.pool.manage`
- gift workflow report: `campaign.reports.view`

Campaign Studio:

- view: `campaign.view`
- update campaign settings: `campaign.admin`
- milestone/rule/policy changes: `campaign.admin`
- team assignments: `campaign.admin`

Reports:

- all reports: `campaign.reports.view`

### Tests

Add endpoint tests using users assigned to narrow roles:

- sponsor manager cannot edit recipients
- people manager cannot update sponsor records
- gift search user can search/commit but cannot receive/wrap gifts
- gift operations user can receive/wrap/distribute but cannot edit campaign rules
- reports viewer can view reports but cannot mutate operational data
- campaign viewer can view basic campaign detail but cannot access restricted feature endpoints

### Deliverables

- endpoint guard updates
- authorization regression tests

## Phase 6: Campaign List And Assignment Awareness

### Goal

Users should only see campaigns they are allowed to access unless they are app admins.

### Backend Tasks

1. Update campaign list query.
   - `APP_ADMIN`: all campaigns.
   - `APP_USER`: campaigns with active campaign roles or active campaign member access.

2. Include effective access in campaign list/detail payloads where useful.

3. Add tests:
   - unassigned user sees no campaigns
   - assigned user sees only assigned campaigns
   - app admin sees all campaigns

### Frontend Tasks

1. Show useful empty state when a user has no assigned campaigns.
2. Avoid showing campaign-specific nav groups without an accessible selected campaign.

## Rollout Notes

- Existing app admins keep full access.
- Existing app users should not receive implicit campaign access unless we intentionally backfill assignments.
- If a temporary development shortcut is needed, backfill selected users as `CAMPAIGN_MANAGER` for current campaigns, but keep that out of production defaults.
- Route-level backend checks should be completed before relying on frontend gating.

## Acceptance Criteria

- App admin can assign campaign roles to a user from User Management.
- Non-admin cannot access user access management APIs.
- A user assigned only `SPONSOR_MANAGER` can use sponsor screens for that campaign and cannot edit people or campaign rules.
- A user assigned only `GIFT_OPERATIONS` can perform gift operations and cannot manage sponsors or people.
- A reports-only user can view reports and cannot mutate campaign data.
- Sidebar and direct routes reflect the user's selected-campaign capabilities.
- Backend tests prove enforcement for each narrow role.
