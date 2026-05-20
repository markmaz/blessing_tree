# Campaign Team Design

Last updated: 2026-05-20

## Status

- Proposed and accepted for implementation planning on 2026-05-20
- Implementation sequencing is now documented in:
  - `docs/engineering/campaign-team-implementation-plan.md`

## Purpose

The current Team section is too narrow for real campaign operations.

Today it is centered on:

- searching existing app users
- choosing one campaign role
- creating one assignment at a time

That is not enough for the actual operating model.

Campaign staff need to manage:

- people who do not log into the app
- people with multiple responsibilities
- named teams for communication and coordination
- optional app access per person
- role- and team-based email audiences

This design turns Team into a real campaign workforce workspace rather than a
thin RBAC editor.

## Summary

Blessing Tree should separate these concepts:

1. Campaign members
2. App access roles
3. Teams
4. Email audiences

Recommended model:

- `campaign_member` is the campaign roster source of truth
- app access is optional through nullable `app_user_id`
- access roles stay fixed and capability-based for RBAC
- teams are user-defined operational groups
- role-based and team-based audiences should be available for communications

This is intentionally simpler than a fully dynamic RBAC system while still
supporting the operational flexibility the campaign needs.

## Problems With The Current Team UI

### It Assumes Every Person Is An App User

That is false for this domain.

Some people should be tracked as part of the campaign team even if they:

- never log in
- never get invited
- only need to be contacted by email or phone

### It Treats Roles As The Only Grouping Mechanism

That is too rigid.

Examples like:

- Gift Coordinator
- Sponsor Caller
- Warehouse Crew
- Pickup Weekend Team

are often communication or coordination groups, not permission bundles.

### It Does Not Support Multiple Responsibilities Cleanly

People may need:

- multiple app access roles
- multiple operational group memberships
- no app access at all

The current one-search, one-role flow does not scale to that.

### It Does Not Support Team-Targeted Communications Well

The communications builder and scheduler will eventually need audiences like:

- all sponsor callers
- all pickup volunteers
- all members with app access
- all gift coordinators

Those should be first-class targeting options, not ad hoc filters.

## Design Principles

### Campaign Roster First

The campaign roster should not depend on app access.

People belong to the campaign even when they do not have a login.

### Access Roles And Operational Grouping Must Be Separate

App permissions and operational organization are related but not identical.

Keep them separate.

### One Person Can Hold Multiple Assignments

One person may be:

- a `GIFT_CHECKIN` app user
- on the `Sponsor Callers` team
- on the `Pickup Weekend` team

The system should model that directly instead of forcing combined roles.

### Team Workspace Should Be Table-First

The Team builder should behave like a Query Forge management workspace:

- summary across the top
- table in the center
- row click opens a drawer
- focused create/edit workflows

## Core Domain Concepts

### 1. Campaign Member

`campaign_member` is the main roster entity.

Recommended fields:

- `id`
- `campaign_id`
- `display_name`
- `email`
- `phone`
- `notes`
- `member_type`
- `app_user_id` nullable
- `app_access_status`
- `is_active`
- timestamps

Recommended `member_type` values:

- `staff`
- `volunteer`
- `contact`
- `external`

Recommended `app_access_status` values:

- `none`
- `linked`
- `invited`
- `active`

Meaning:

- `none`: this member is roster-only
- `linked`: linked to an app user but not fully activated for campaign use yet
- `invited`: app invitation sent but not accepted
- `active`: linked and active in the application

### 2. App User Link

`campaign_member.app_user_id` should be nullable.

This keeps one roster for:

- app-enabled operators
- non-app volunteers
- external contacts

Recommendation:

- do not create fake app users just to track campaign people
- link a real `app_user` only when app access is actually needed

### 3. Access Roles

Access roles remain the RBAC surface.

They should stay:

- code-defined
- capability-based
- backend-authoritative

Examples:

- `CAMPAIGN_MANAGER`
- `RECIPIENT_COORDINATOR`
- `DONATION_ENTRY`
- `GIFT_CHECKIN`
- `VOLUNTEER_VIEWER`

Important distinction:

- access roles are for permissions
- they are not the same thing as campaign teams

### 4. Teams

Teams are user-defined campaign groups.

Recommended fields for `campaign_team`:

- `id`
- `campaign_id`
- `name`
- `description`
- `is_active`
- timestamps

Recommended join table:

- `campaign_team_member`
  - `id`
  - `team_id`
  - `campaign_member_id`
  - timestamps

Examples:

- Sponsor Callers
- Gift Coordinators
- Warehouse Crew
- Pickup Weekend
- Family Intake

Teams are for:

- operations
- communication targeting
- coordination

They are not permission bundles.

### 5. Communication Audiences

The communications system should eventually support audiences based on:

- one or more teams
- one or more access roles
- all members with email
- all members with app access
- manual member selection

This should be designed now even if the actual scheduler integration lands later.

## Recommended Data Model

### New Tables

#### `campaign_member`

- roster entity for campaign people

#### `campaign_member_access_role`

- `id`
- `campaign_member_id`
- `role_key`
- `is_active`
- timestamps

Recommendation:

- this should eventually replace the direct `campaign_user_role` shape
- access resolution for a logged-in user should work through:
  - `app_user.id`
  - linked `campaign_member`
  - active member access roles

#### `campaign_team`

- named campaign teams

#### `campaign_team_member`

- team membership join

### Migration Direction

The current `campaign_user_role` table is good enough for the first RBAC pass
but is not the right long-term roster model.

Recommended migration path:

1. add `campaign_member`
2. backfill members for existing `campaign_user_role` rows using linked app users
3. add `campaign_member_access_role`
4. move authorization resolution to member-linked access roles
5. keep compatibility reads during transition
6. retire direct `campaign_user_role` once migrated

## Team Workspace UI

## Summary Row

Keep the current summary style, but expand it.

Recommended summary cards:

- Managers
- Active Assignments
- Unique Members
- Members With App Access
- Teams

The current `Managers` and `Active Assignments` metrics should stay.

## Primary Layout

Use a table-centered workspace with drawers.

Recommended layout:

- summary row at top
- filter/search toolbar
- member table
- row click opens member drawer

### Table Columns

Recommended default columns:

- Name
- Email
- App Access
- Access Roles
- Teams
- Member Type
- Status

Optional future columns:

- Phone
- Last activity
- Notes indicator

### Toolbar Controls

Recommended controls:

- search by name/email
- filter by app access
- filter by team
- filter by role
- filter by active/inactive
- `Add Member`
- `Create Team`

### Row Interaction

Clicking a row should open a right-side drawer.

This is the Query Forge-style interaction model the user requested.

## Member Drawer

The member drawer should be the main edit surface.

Recommended sections:

### Profile

- name
- email
- phone
- member type
- notes
- active/inactive

### App Access

- current app access status
- linked app user, if present
- button to link app user
- button to invite app access
- button to remove app access

### Access Roles

- current access role assignments
- add role
- deactivate role
- reactivate role

Allow multiple roles per member.

### Teams

- current team memberships
- add to team
- remove from team
- create a new team from the drawer if needed

## Team Management UI

Teams need their own focused workflow as well.

Recommended first step:

- `Create Team` opens a drawer
- from there managers can:
  - name the team
  - describe it
  - choose active/inactive

Recommended later step:

- allow opening a team detail drawer from filters or from a member row
- show:
  - team members
  - email-eligible members
  - linked communication usage

## Access Role Strategy

Do not make campaign managers create arbitrary permission roles in v1.

Recommendation:

- keep access roles fixed in code
- keep teams user-defined

Reason:

- permissions need stable backend meaning
- teams provide the flexibility the user wants for real-world coordination

Examples:

- `Gift Coordinator` should usually be a team, not a permission role
- `Sponsor Caller` should usually be a team, not a permission role
- `GIFT_CHECKIN` remains an access role because it controls app behavior

If a future need emerges for user-defined operational labels beyond teams, add:

- member tags
- or team categories

before introducing dynamic permission roles.

## App Access Rules

### Members Without App Access

These should still be fully manageable in Team:

- visible in roster
- assignable to teams
- eligible for communications if email exists
- able to carry notes and contact info

They simply do not get backend/UI authorization.

### Members With App Access

These can:

- hold access roles
- appear in authz resolution
- be invited or linked through `app_user`

Recommendation:

- only linked active app users should affect RBAC

## Backend API Design

Recommended campaign-scoped endpoints:

### Members

- `GET /api/v1/campaigns/:campaignId/members`
- `POST /api/v1/campaigns/:campaignId/members`
- `GET /api/v1/campaigns/:campaignId/members/:memberId`
- `PATCH /api/v1/campaigns/:campaignId/members/:memberId`

### Teams

- `GET /api/v1/campaigns/:campaignId/teams`
- `POST /api/v1/campaigns/:campaignId/teams`
- `PATCH /api/v1/campaigns/:campaignId/teams/:teamId`

### Team Membership

- `POST /api/v1/campaigns/:campaignId/teams/:teamId/members`
- `DELETE /api/v1/campaigns/:campaignId/teams/:teamId/members/:memberId`

### Access Roles

- `GET /api/v1/campaigns/:campaignId/member-access-roles`
- `POST /api/v1/campaigns/:campaignId/members/:memberId/access-roles`
- `PATCH /api/v1/campaigns/:campaignId/members/:memberId/access-roles/:assignmentId`

### App Access Linking

- `POST /api/v1/campaigns/:campaignId/members/:memberId/link-app-user`
- `POST /api/v1/campaigns/:campaignId/members/:memberId/invite-app-access`
- `DELETE /api/v1/campaigns/:campaignId/members/:memberId/app-access`

## Frontend API Contract

The Team workspace should not fetch tiny fragments one at a time by default.

Recommended aggregate payload:

- member list with:
  - profile
  - app access summary
  - active access roles
  - active teams
- team list
- summary counts
- available fixed access roles

This can be:

- one aggregate Team endpoint
- or one members endpoint plus lightweight teams/roles endpoints

Preference:

- aggregate team workspace payload first
- row-detail drawer fetch only if later needed for scaling

## Permissions

Recommended capability model:

- viewing team roster:
  - `campaign.view`
- mutating members/teams:
  - `campaign.admin`

Reason:

- team structure directly affects operations and communications
- keep mutation authority narrow in v1

Later, if needed, add a narrower capability like:

- `campaign.team.manage`

## Email Targeting Implications

The communications system should eventually consume this model directly.

Recommended audience options:

- by team
- by access role
- by app access status
- by member type
- by manual selection

This is one of the main reasons not to overload access roles with all grouping behavior.

## Query Forge Interaction Reference

The Team workspace should borrow these interaction ideas from Query Forge:

- table-first management
- row selection opens drawers
- actions stay focused and contextual
- the center workspace remains readable instead of turning into nested forms

It should not copy Query Forge complexity that Blessing Tree does not need.

## Recommended Delivery Order

1. write and approve this design
2. add `campaign_member`
3. add `campaign_team` and `campaign_team_member`
4. add member list/create/update APIs
5. add team create/update APIs
6. add member drawer UI
7. move access-role assignment to member-centric workflows
8. wire communication audiences to roles/teams later

## Decision Summary

Lock these decisions:

- campaign roster is separate from app users
- app access is optional
- access roles remain fixed and code-defined
- teams are user-defined and support communications targeting
- Team UI becomes table-plus-drawer
- dynamic permission-role creation remains out of scope for v1
