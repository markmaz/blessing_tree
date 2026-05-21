# Campaign Studio AI Actions Design

Last updated: 2026-05-21

## Status

- Proposed and accepted for implementation planning on 2026-05-21
- Phase 1 is now implemented as of 2026-05-21:
  - backend `POST /api/v1/campaigns/<campaign_id>/ai/draft`
  - normalized schedule draft actions
  - frontend AI action-card rendering and apply wiring for schedule actions
- Phase 2 is now implemented as of 2026-05-21:
  - Communications prompts can now draft `create_template` actions
  - Communications prompts can optionally bundle `create_communication_schedule` actions
  - frontend `Apply All` now resolves newly created template IDs before applying dependent communication schedule actions
- Phase 3 is now implemented as of 2026-05-21:
  - Team prompts can now draft `create_team`, `create_team_role`, `create_member`, and `assign_member_to_team` actions
  - Team `Apply All` now resolves created team, team-role, and member IDs before applying dependent membership actions
  - explanatory Team prompts still stay advisory and action-free
- Phase 4 is now implemented as of 2026-05-21:
  - Readiness prompts can now draft cross-section fix bundles instead of staying advisory-only
  - Readiness can now propose a mix of actionable fixes and blocked fix-plan cards when the app still needs a specific person, date range, or policy choice
  - readiness-generated settings updates now apply through the normal campaign update path
- Phase 5 is now implemented as of 2026-05-21:
  - Settings prompts can now draft concrete campaign setting updates and lifecycle/status suggestions
  - lifecycle suggestions now respect readiness and transition rules, returning blocked status-change cards when the campaign is not ready
  - the AI drawer now supports inline edit-before-apply for scalar settings/status changes

## Purpose

Campaign Studio AI should do more than explain the current screen.

It should let an operator prompt for real structured work inside the current
Studio section, preview the proposed changes, and then apply those changes
through the same backend APIs that power manual editing.

Examples:

- build a sponsor reminder template
- place that communication on the campaign calendar
- create milestone dates
- create manual planning events
- propose teams and team roles
- organize readiness fixes into concrete next actions

AI should not write directly to the database without review.

## Summary

Campaign Studio AI should follow a `draft -> review -> apply` model.

The AI panel should:

- understand the currently selected Studio section
- accept a natural-language prompt
- produce structured proposed actions
- explain assumptions and warnings
- let the user apply all or apply selected actions

The AI layer should draft changes.

The existing feature APIs should remain the source of truth for persistence.

## Goals

Campaign Studio AI should:

- perform useful section-scoped work
- stay tied to the current campaign and Studio section
- return structured actions instead of loose text only
- require human approval before persistence
- reuse existing domain APIs for apply
- make it obvious what will be created or changed

## Non-Goals

Campaign Studio AI should not:

- become a generic chat assistant detached from Studio state
- write directly to tables without preview
- bypass backend validation or authorization
- invent new persistence paths when existing feature APIs already exist
- hide assumptions that affect operator trust

## Product Model

The Campaign Studio AI drawer is a section-scoped action planner.

It should always know:

- `campaign_id`
- current Studio section
- campaign summary context
- section-specific context
- readiness context when relevant

The user provides intent in natural language.

The AI returns a structured action plan the user can inspect and apply.

## Core Interaction Model

### 1. Prompt

The user enters a request such as:

- "Create a sponsor reminder email and place it 10 days before pickup."
- "Add the missing milestone dates for registration and sponsor outreach."
- "Set up a warehouse crew team with lead, runner, and check-in roles."

### 2. Draft

The backend AI orchestration layer returns:

- plain-language response summary
- assumptions
- warnings
- structured actions

### 3. Review

The frontend renders each proposed action as a concrete card.

Examples:

- `New Template`
- `New Calendar Communication`
- `New Milestone`
- `New Team`
- `New Team Role`
- `Assign Member To Team`

Each action card should show:

- what will be created or changed
- key fields
- confidence or assumption notes if needed
- whether the action is valid right now

### 4. Apply

The user can:

- apply one action
- apply selected actions
- apply all actions
- discard actions

Apply should call the existing feature APIs, not a special AI-write endpoint.

## Draft And Apply Separation

The AI orchestration layer should never be the final persistence layer.

Recommendation:

- AI draft endpoint returns proposals only
- existing domain APIs perform all writes

This keeps:

- validation consistent
- authz consistent
- audit behavior clearer
- AI behavior easier to trust

## Structured Action Model

Each AI action should use a normalized shape.

```json
{
  "id": "draft-action-1",
  "action_type": "create_template",
  "section": "communications",
  "title": "Sponsor Reminder Template",
  "summary": "Creates an email template for sponsor reminder outreach.",
  "status": "ready",
  "assumptions": [
    "Uses the pickup date as the anchor for reminder timing."
  ],
  "warnings": [],
  "payload": {},
  "apply_target": {
    "api": "communication_template.create",
    "method": "POST"
  }
}
```

Required fields:

- `id`
- `action_type`
- `section`
- `title`
- `summary`
- `status`
- `assumptions`
- `warnings`
- `payload`
- `apply_target`

Recommended `status` values:

- `ready`
- `needs_review`
- `blocked`

`blocked` means the action cannot be applied until some dependency is resolved.

## Initial Action Types

### Communications

- `create_template`
- `update_template`
- `duplicate_template`

### Schedule

- `create_event`
- `update_event`
- `create_milestone`
- `update_milestone`
- `create_communication_schedule`
- `update_communication_schedule`

### Team

- `create_member`
- `update_member`
- `create_team`
- `update_team`
- `create_team_role`
- `update_team_role`
- `assign_member_to_team`
- `assign_app_access_role`

### Readiness

- `resolve_readiness_gap`
- `batch_fix_plan`

### Settings

- `update_campaign_settings`
- `suggest_status_change`

## Section Capability Rules

The AI drawer should only expose actions that make sense in the current Studio
section.

### Communications Section

Allowed draft actions:

- create templates
- refine template content
- suggest merge fields
- optionally create linked communication schedule actions

Important rule:

- communication scheduling may be proposed here
- but schedule placement must still appear as an explicit schedule action

Example prompt:

- "Build a pickup reminder email and schedule it for the Monday before pickup."

Expected action bundle:

- `create_template`
- `create_communication_schedule`

### Schedule Section

Allowed draft actions:

- create or update milestones
- create or update manual events
- create or update communication schedule items

Example prompt:

- "Add volunteer orientation, sorting day, and pickup staffing blocks."

Expected action bundle:

- `create_event`
- `create_event`
- `create_event`

### Team Section

Allowed draft actions:

- create members
- create teams
- create team roles
- assign members to teams
- assign app access roles

Example prompt:

- "Set up a Warehouse Crew with Lead, Runner, and Gift Check-In roles."

Expected action bundle:

- `create_team`
- `create_team_role`
- `create_team_role`
- `create_team_role`

### Readiness Section

Allowed draft actions:

- explain blockers
- convert readiness findings into actionable fix plans
- generate grouped fix bundles that route to other sections

Important rule:

- readiness AI should not become read-only
- it should be able to propose actionable bundles

Example prompt:

- "Fix the activation blockers for me."

Expected result:

- one or more proposed actions in Team, Schedule, Communications, or Settings
- explicit note about anything still blocked by missing data

### Settings Section

Allowed draft actions:

- update metadata
- suggest lifecycle changes
- explain lifecycle impacts

## Backend API Shape

Recommendation:

- add one AI draft endpoint for Studio orchestration
- keep existing feature endpoints for apply

Suggested endpoint:

- `POST /api/v1/campaigns/<campaign_id>/ai/draft`

Input:

```json
{
  "section": "communications",
  "prompt": "Create a sponsor reminder template and schedule it 10 days before pickup.",
  "context": {
    "selected_template_id": null,
    "selected_member_id": null,
    "selected_team_id": null
  }
}
```

Output:

```json
{
  "message": "I drafted a sponsor reminder template and a linked calendar communication.",
  "assumptions": [
    "Pickup date is the correct anchor for this reminder."
  ],
  "warnings": [
    "Automated delivery is not wired yet, so this only creates the planned schedule item."
  ],
  "actions": []
}
```

The backend draft layer may use:

- campaign data
- readiness findings
- section payloads already available through Studio APIs

It should not itself persist the proposed changes.

## Apply Flow

Frontend apply behavior should map AI actions onto existing APIs.

Examples:

- `create_template`
  - existing communications template create endpoint
- `create_communication_schedule`
  - existing schedule/communication create endpoint
- `create_event`
  - existing campaign event create endpoint
- `create_milestone`
  - existing milestone save path
- `create_team`
  - existing team create endpoint
- `create_team_role`
  - existing team-role create endpoint

Recommendation:

- the frontend should own action-to-API mapping first
- only add a backend batch apply endpoint later if the UX truly needs atomic apply

## Action Bundles

Some prompts should return multiple related actions.

Example:

- "Create a sponsor reminder template and put it on the calendar."

Bundle:

1. `create_template`
2. `create_communication_schedule`

Example:

- "Set up the warehouse team."

Bundle:

1. `create_team`
2. `create_team_role`
3. `create_team_role`
4. `create_team_role`

The UI should make multi-action bundles feel intentional:

- one draft response
- multiple action cards
- apply selected or apply all

## UI Rendering Model

The current AI thread/drawer model should evolve into:

- response summary
- assumptions
- warnings
- action cards
- apply controls

Recommended per-action card controls:

- `Apply`
- `Edit Before Apply`
- `Discard`

Recommended per-response controls:

- `Apply All`
- `Apply Selected`
- `Discard All`

## Editing Before Apply

Some AI actions should support user edits before apply.

Examples:

- a template subject line
- an event date
- a milestone date
- a team role label

Recommendation:

- support lightweight inline edits first
- route the user into the native section form when the change becomes structural,
  multi-step, or layout-heavy

Recommended inline-edit boundary:

- keep editing inline for small scalar adjustments such as:
  - template subject
  - one event date or title
  - one milestone date
  - one team role label
- route into the native form for:
  - multi-block email content editing
  - large calendar adjustments with several dependent dates
  - multi-member team changes
  - any action where the user needs the full section context to verify the result

This keeps the AI drawer fast for simple corrections without turning it into a
second full editor.

## Readiness Integration

AI should read readiness and respond with section-aware actions.

Examples:

- if readiness reports missing manager coverage, Team AI should suggest:
  - create member
  - assign app access role
  - assign to team
- if readiness reports missing communication timing, Schedule or Communications
  AI should suggest:
  - create communication schedule
- if readiness reports automation unavailable, AI should say so explicitly and
  avoid pretending a scheduled item will auto-send

## Automation Boundary

AI may create planned communication schedules and lifecycle timing records.

AI may not imply that real delivery or timed campaign-state changes are fully
operational until the scheduler/execution layer exists.

Until then:

- AI can plan
- AI can create schedule records
- readiness must still warn when delivery automation is unavailable

## Security And Trust Rules

- backend authz remains authoritative
- AI apply must use the same protected feature endpoints as manual actions
- AI may not bypass section validation
- blocked actions must render clearly as blocked
- assumptions must be visible when the draft depends on inferred context

## Delivery Phases

### Phase 1

- define AI draft contract
- add backend draft endpoint
- generalize the current Schedule draft/apply path into normalized actions

Status:

- implemented on 2026-05-21

### Phase 2

- implement Communications AI actions
- support template creation plus optional schedule placement bundles

### Phase 3

- implement Team AI actions
- support teams, team roles, and member/team assignment bundles

### Phase 4

- implement Readiness AI fix-plan actions
- allow grouped fix recommendations across multiple Studio sections

### Phase 5

- refine editing-before-apply
- consider batch apply if UX pressure warrants it
- connect to real automation execution once the scheduler layer exists

Status:

- implemented for Settings/status scalar edits on 2026-05-21
- batch apply remains best-effort and non-transactional
- broader edit-before-apply support for higher-complexity bundles is still future work

## Open Questions

- `Apply All` should be best-effort across multiple actions, not transactional
- AI should ask before updating an existing template instead of defaulting to
  overwriting one
- inline editing should stay limited to small scalar adjustments; structural or
  multi-step edits should route into the native section form
- AI action drafts should remain transient and should not be persisted
  server-side for longer review sessions by default

## Recommendation

Implement Campaign Studio AI as a structured action system, not a chat-only
assistant.

The key decisions are:

- draft, never direct-write
- section-scoped actions
- existing APIs stay authoritative for apply
- action bundles for multi-step requests
- explicit visibility into assumptions, warnings, and automation gaps
