# Campaign Readiness Design

## Status

- Proposed and accepted for implementation on 2026-05-20

## Summary

Campaign Readiness is the backend-driven control surface that tells operators:

- what is missing
- what is blocking the next lifecycle step
- what should be fixed soon
- what automated behavior is not wired or not healthy

Readiness is not a generic alert list.

It is a structured campaign-operability evaluator tied to campaign lifecycle,
Studio sections, and future automation.

Related designs:

- `docs/engineering/campaign-api-design.md`
- `docs/engineering/campaign-studio-design.md`
- `docs/engineering/campaign-schedule-design.md`
- `docs/engineering/campaign-team-design.md`

## Goals

Campaign Readiness should:

- stay backend-authoritative
- group findings in ways operators understand
- distinguish blockers from gaps
- distinguish draft setup from live operational health
- route the user directly to the place where the fix belongs
- eventually bridge campaign planning and automation execution

## Non-Goals

Campaign Readiness should not:

- become a flat dumping ground of every possible warning
- block everything with the same severity model
- rely on frontend-only checks
- try to replace section-level validation
- become a passive dashboard with no actions

## Product Model

Readiness should answer a phase-specific question:

- can this campaign continue as a draft?
- can this campaign be activated?
- can this campaign operate safely?
- can this campaign be closed cleanly?

That means one overall readiness status is not enough on its own.

## Lifecycle-Aware Readiness

Readiness should be evaluated across these operational phases:

- `draft`
- `activate`
- `operations`
- `close`

Each readiness item may affect one or more phases.

Examples:

- missing campaign manager
  - blocks `activate`
  - blocks `operations`
- missing description
  - gap for `draft`
  - warning for `activate`
- missing scheduled communications
  - warning for `activate`
  - warning or error for `operations` depending on intent
- missing automation worker
  - may not matter in `draft`
  - blocks `operations` if scheduled behavior is expected

## Core Readiness Categories

The UI should group findings by meaning, not only by severity.

Primary categories:

- `blockers`
  - must be fixed before the relevant lifecycle step
- `launch_checks`
  - expected before activating/opening the campaign
- `planning_gaps`
  - campaign is incomplete or under-planned, but not strictly blocked
- `operational_health`
  - campaign is active but has execution or staffing issues

These categories are stable enough to become first-class API concepts.

## Rule Output Shape

Each backend rule should return a normalized readiness item:

```json
{
  "code": "missing_manager",
  "severity": "error",
  "category": "blockers",
  "section": "team",
  "message": "Assign at least one campaign manager.",
  "action_label": "Open Team",
  "blocking_for": ["activate", "operations"],
  "details": {}
}
```

Required fields:

- `code`
- `severity`
- `category`
- `section`
- `message`
- `action_label`
- `blocking_for`
- `details`

Optional later fields:

- `title`
- `why_this_matters`
- `recommended_next_step`
- `entity_refs`
- `automation_capability`

## Severity Rules

Severity should stay simple:

- `error`
  - blocks at least one lifecycle phase
- `warning`
  - not blocking by default, but needs attention
- `info`
  - advisory only

Do not overload severity to represent lifecycle phase.
Use `blocking_for` for that.

## Backend Response Shape

Recommendation:

- keep a compact overall summary
- include grouped sections for UI rendering
- retain raw items for compatibility and filtering

```json
{
  "campaign_id": "uuid",
  "overall_status": "NEEDS_ATTENTION",
  "phase_status": {
    "draft": "READY",
    "activate": "BLOCKED",
    "operations": "NEEDS_ATTENTION",
    "close": "READY"
  },
  "counts": {
    "errors": 1,
    "warnings": 4,
    "infos": 2
  },
  "groups": {
    "blockers": [],
    "launch_checks": [],
    "planning_gaps": [],
    "operational_health": []
  },
  "items": []
}
```

`overall_status` recommendation:

- `BLOCKED`
  - if any active relevant blocker exists
- `NEEDS_ATTENTION`
  - if no blockers but warnings or infos exist
- `READY`
  - if no findings remain

## Rule Families

Readiness should be implemented as grouped rule families, not one large inline function.

Recommended family split:

- `campaign_metadata_rules`
- `team_rules`
- `schedule_rules`
- `communications_rules`
- `automation_rules`
- `recipient_rules`
- `operations_rules`

Short-term note:

- current `studio_readiness.py` can become the orchestrator
- move individual rule families into smaller modules as implementation grows

## Initial Rule Set

### Campaign Metadata Rules

- missing description
- missing start/end date
- draft status still active as informational
- invalid lifecycle sequencing if that state can occur

### Team Rules

- missing campaign manager
- missing non-manager support coverage
- later:
  - missing members on required teams
  - missing team roles once team roles exist

### Schedule Rules

- missing required milestones
- missing manual planning events
- milestone dates lacking communication timing
- later:
  - campaign has no events near opening/closing windows
  - overdue schedule items

### Communications Rules

- no active templates
- no active communication schedules
- later:
  - templates exist but are missing required merge fields
  - audience target is undefined

### Automation Rules

These are not fully implemented yet, but the design should reserve them now:

- no scheduler configured
- no worker capable of sending communications
- scheduled item exists but has no executable delivery path
- lifecycle automation expected but not configured
- execution failures for scheduled actions

### Recipient/Operations Rules

Defer until those feature slices exist, but design for them now:

- no recipient intake configured
- no wishlist coverage
- no pickup path
- no fulfillment staffing

## UI Design Direction

Readiness should move away from a single flat list.

Recommended layout:

### Top Summary

- overall readiness
- blocker count
- launch check count
- planning gap count

### Phase Strip

- Draft
- Activate
- Operations
- Close

Each phase should show:

- `Ready`
- `Needs Attention`
- `Blocked`

### Grouped Findings

- Blockers
- Launch Checks
- Planning Gaps
- Operational Health

Each item should show:

- message
- severity marker
- optional short explanation
- action button

### Action Routing

Every readiness item should route the user to a real Studio section:

- `settings`
- `team`
- `communications`
- `schedule`
- future:
  - `recipients`
  - `wishlists`
  - `donations`

## AI Integration

Readiness should feed the AI rail directly.

Use readiness to provide:

- contextual prompt starters
- current blocking signals
- recommended next actions

Examples:

- “Add the missing milestone dates before launch.”
- “Create communication timing for these scheduled milestones.”
- “Suggest the team structure needed to remove launch blockers.”

AI should never invent readiness state on its own.
It should consume backend readiness output.

## Automation Relationship

Readiness becomes more important once scheduling is executable.

It should become the operator’s first signal for:

- automation not configured
- scheduled work not deliverable
- overdue communications
- lifecycle transitions that should have happened but did not

That means readiness is not just setup validation.
It becomes the health layer between Studio planning and real execution.

## Implementation Plan

Recommended sequence:

1. Normalize readiness item shape with `category`, `action_label`, and `blocking_for`
2. Refactor current readiness builder into rule-family functions
3. Change the frontend Readiness page to grouped sections instead of one flat list
4. Add phase status summary to the response and UI
5. Expand AI prompt generation to use grouped readiness plus phase data
6. Add automation rules once scheduled execution exists

## Current Gap

Current readiness already checks:

- campaign description
- campaign date range
- campaign manager presence
- non-manager assignment coverage
- required milestones
- manual schedule coverage
- milestone-linked communication timing
- active templates
- active communication schedules
- draft status

Current readiness does not yet support:

- grouped categories
- lifecycle phase gating
- action labels
- automation readiness
- operations health after schedule execution exists

This design replaces the current flat model with a lifecycle-aware, grouped readiness system.
