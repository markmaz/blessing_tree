# Campaign Team Implementation Plan

Last updated: 2026-05-20

## Status

- Phases 1 through 5 are implemented.
- This revision adds phases 6 through 10 to separate app access roles from
  team-scoped roles and to carry that distinction through communications.

## Objective

Implement the Campaign Team redesign in a way that supports:

- a real campaign roster independent of app login
- fixed RBAC access roles for app behavior
- user-defined teams for operations and communication targeting
- optional team-scoped roles for operational responsibility
- a Query Forge-style table-plus-drawer Team workspace
- a safe transition from the current assignment-only model

This plan follows the design in:

- `docs/engineering/campaign-team-design.md`

## Delivery Strategy

Do not replace the current Team flow in one jump.

The current Campaign Studio Team section is already live and backed by:

- `campaign_user_role`
- app-user directory search
- assignment APIs

The redesign should land in layers so the backend model, RBAC path, and Studio
surface can evolve without breaking existing campaign access behavior.

## Phase 1: Roster Foundation

### Goal

Create the campaign roster model without changing authorization yet.

### Tasks

1. Add `campaign_member`
   - create DB migration
   - add SQLAlchemy model
   - add indexes for campaign, email, active status, and optional app-user link

2. Add campaign-member relationships
   - `Campaign -> campaign_members`
   - `AppUser -> campaign_members`

3. Add member enums and validation
   - `member_type`
   - `app_access_status`
   - active/inactive behavior

4. Add compatibility bootstrap logic
   - define how existing `campaign_user_role` rows will map to roster members
   - document backfill expectations before role migration begins

### Deliverables

- migration for `campaign_member`
- model file
- relationship wiring
- validation constants

## Phase 2: Member Access Role Transition Layer

### Goal

Introduce a member-centric access-role model while keeping current RBAC working.

### Tasks

1. Add `campaign_member_access_role`
   - create DB migration
   - add model
   - add uniqueness constraint around active member-role scope

2. Backfill from `campaign_user_role`
   - create member records for linked app users where needed
   - create member access-role rows from existing campaign-user-role rows

3. Add compatibility reads
   - authorization service should resolve effective campaign roles through member access roles
   - transitional fallback reads from `campaign_user_role` remain available until migration is complete

4. Define cutover rules
   - only linked active app users affect RBAC
   - roster-only members can carry operational metadata but not authorization

### Deliverables

- migration for `campaign_member_access_role`
- backfill logic
- transitional authorization resolution
- documented cutover behavior

## Phase 3: Team Model Foundation

### Goal

Add user-defined campaign teams as a separate operational concept.

### Tasks

1. Add `campaign_team`
   - create DB migration
   - add model
   - include campaign-scoped uniqueness for active team names

2. Add `campaign_team_member`
   - create DB migration
   - add join model
   - add uniqueness constraint for team/member pairs

3. Add basic service layer
   - create team
   - rename/update team
   - add/remove member from team
   - list teams and membership counts

### Deliverables

- migrations for `campaign_team` and `campaign_team_member`
- models
- service layer for team membership

## Phase 4: Member-Centric Team APIs

### Goal

Expose a stable backend contract for the new Team workspace.

### Tasks

1. Add member APIs
   - `GET /api/v1/campaigns/:campaignId/members`
   - `POST /api/v1/campaigns/:campaignId/members`
   - `GET /api/v1/campaigns/:campaignId/members/:memberId`
   - `PATCH /api/v1/campaigns/:campaignId/members/:memberId`

2. Add team APIs
   - `GET /api/v1/campaigns/:campaignId/teams`
   - `POST /api/v1/campaigns/:campaignId/teams`
   - `PATCH /api/v1/campaigns/:campaignId/teams/:teamId`

3. Add team membership APIs
   - `POST /api/v1/campaigns/:campaignId/teams/:teamId/members`
   - `DELETE /api/v1/campaigns/:campaignId/teams/:teamId/members/:memberId`

4. Add member access-role APIs
   - `GET /api/v1/campaigns/:campaignId/member-access-roles`
   - `POST /api/v1/campaigns/:campaignId/members/:memberId/access-roles`
   - `PATCH /api/v1/campaigns/:campaignId/members/:memberId/access-roles/:assignmentId`

5. Add app-access linking APIs
   - `POST /api/v1/campaigns/:campaignId/members/:memberId/link-app-user`
   - `POST /api/v1/campaigns/:campaignId/members/:memberId/invite-app-access`
   - `DELETE /api/v1/campaigns/:campaignId/members/:memberId/app-access`

6. Add aggregate Team workspace payload
   - member list with profile, app access, access roles, and teams
   - summary metrics
   - filter options for roles and teams

### Deliverables

- member/team/access-role APIs
- aggregate Team workspace contract
- serializer and validation layer

## Phase 5: Frontend Team Workspace Rewrite

### Goal

Replace the current assignment-first Team UI with the table-plus-drawer workspace.

### Tasks

1. Build Team workspace summary row
   - Managers
   - Active Assignments
   - Unique Members
   - Members With App Access
   - Teams

2. Build member table
   - search
   - app-access filter
   - role filter
   - team filter
   - active/inactive filter

3. Build member drawer
   - profile
   - app access
   - access roles
   - teams

4. Build team creation/edit workflow
   - `Create Team` action
   - team drawer or modal

5. Keep transitional compatibility until cutover
   - do not remove current assignment data from Studio until the new aggregate payload is fully wired

### Deliverables

- new Team table workspace
- drawer-based member editing
- team creation/edit flow
- frontend automated tests for the new workspace

## Phase 6: Team Role Separation

### Goal

Separate app access roles from team-scoped operational roles.

### Tasks

1. Add `campaign_team_role`
   - create DB migration
   - add model
   - add uniqueness constraint for team-scoped role names
   - add ordering and active status support

2. Extend `campaign_team_member`
   - add nullable `team_role_id`
   - interpret `null` as plain `Member` participation
   - keep one membership row per member/team pair

3. Update backend service rules
   - allow member assignment to a team with no explicit role
   - validate that explicit team roles belong to the target team
   - prevent access-role keys from being reused as implicit team roles

4. Add app access role catalog contract
   - expose fixed RBAC roles from the backend
   - stop duplicating app access role definitions in the frontend
   - rename frontend labels to `App Access Roles`

### Deliverables

- migration for `campaign_team_role` and `campaign_team_member.team_role_id`
- model and relationship wiring
- service-layer support for role-less and role-specific team membership
- backend app access role catalog contract

## Phase 7: Team Role APIs And Workspace Expansion

### Goal

Make teams and team roles manageable in the same workflow.

### Tasks

1. Add team-role APIs
   - `GET /api/v1/campaigns/:campaignId/teams/:teamId/roles`
   - `POST /api/v1/campaigns/:campaignId/teams/:teamId/roles`
   - `PATCH /api/v1/campaigns/:campaignId/teams/:teamId/roles/:roleId`

2. Expand team membership APIs
   - support optional `teamRoleId` on create
   - support updating a member's team role without removing membership

3. Expand Team workspace aggregate payload
   - include app access role catalog from the backend
   - include per-team role catalogs
   - include member team-role assignments
   - keep app access roles and team roles as clearly separate payload fields

4. Add serializer and validation separation
   - `app_access_roles`
   - `team_roles`
   - `team_memberships`

### Deliverables

- team-role CRUD APIs
- expanded team membership APIs
- aggregate workspace contract with separate app access role and team role data

## Phase 8: Frontend Team Workspace Refinement

### Goal

Align the Team Studio experience with the separated access-role and team-role model.

### Tasks

1. Rename UI surfaces
   - `Roles` becomes `App Access Roles` where it refers to RBAC
   - keep team-role language scoped to team membership only

2. Expand the member drawer
   - show app access roles separately from team memberships
   - allow assigning a member to a team with no explicit team role
   - allow assigning or changing a specific team role later

3. Expand the team drawer
   - create/edit team metadata
   - create/edit/deactivate team roles
   - assign members to the team
   - optionally assign a role as part of the membership workflow

4. Replace hardcoded frontend app access role options
   - consume the backend role catalog
   - remove duplicated frontend role definitions where possible

5. Add frontend automated tests
   - role-less membership assignment
   - team-role create/edit
   - app access role display and editing
   - drawer labeling and separation of concerns

### Deliverables

- refined Team workspace UI
- backend-driven app access role options
- team-role-aware member and team drawers
- automated test coverage for the refined flows

## Phase 9: Communications Audience Integration

### Goal

Make Team data useful to communications instead of just visible in Studio.

### Tasks

1. Add audience primitives based on:
   - teams
   - team roles within a team
   - access roles
   - members with email
   - members with app access
   - manual selection

2. Add backend audience resolution helpers
   - resolve campaign recipients by audience definition
   - validate email eligibility

3. Expose audience metadata to the communications builder and scheduler surfaces

### Deliverables

- audience model or contract
- backend audience resolution helpers
- communications integration points

## Phase 10: Cutover And Cleanup

### Goal

Finish the transition off the old assignment-first Team model.

### Tasks

1. Move RBAC to member-centric resolution only
   - remove fallback dependence on direct `campaign_user_role` reads once data is fully migrated

2. Retire transitional APIs and UI
   - old assignment-centric endpoints
   - old Team search/add flow

3. Add any final migration cleanup
   - archive or retire `campaign_user_role` only after the new path is fully proven

### Deliverables

- member-centric Team and access model as the default
- retired transitional Team flow
- documented cleanup status

## Testing Plan

### Backend

- migration tests where practical
- model relationship tests
- member/team service tests
- authorization resolution tests during the transition period
- endpoint tests for members, teams, memberships, and access-role APIs

### Frontend

- table filter/search tests
- drawer open/edit/save tests
- team create/edit tests
- app access role assignment tests
- team role create/edit tests
- role-less team membership tests
- app-access link state tests

### Runtime Verification

For each schema phase:

- apply migration to local MySQL `blessing_tree`
- verify tables, indexes, and foreign keys directly
- verify the running Blessing Tree backend still starts cleanly

## Suggested File Ownership

### Backend

- `blessing-tree-api/app/features/campaigns/`
  - member services
  - team services
  - serializers
  - validation
  - API routes
- `blessing-tree-api/app/models/`
  - `campaign_member.py`
  - `campaign_member_access_role.py`
  - `campaign_team.py`
  - `campaign_team_role.py`
  - `campaign_team_member.py`
- `blessing-tree-api/db/migration/`
  - Team redesign migrations

### Frontend

- `blessing-tree-ui/src/features/campaigns/`
  - Team workspace table
  - member drawer
  - team drawer
  - Team API hooks and contract types

## Proposed Delivery Order

1. `campaign_member` backend foundation
2. member access-role transition layer
3. `campaign_team` and `campaign_team_member`
4. member/team aggregate APIs
5. Team workspace frontend rewrite
6. team-role separation and app access role catalog exposure
7. communications audience integration
8. cutover and cleanup

## Key Decisions Locked By This Plan

- the campaign roster is separate from app login
- app access is optional
- access roles stay fixed and backend-defined
- teams are user-defined and operational
- the current assignment-first Team flow is transitional
- migration should be incremental, not a one-shot rewrite
