# Admin-Managed Milestones And Readiness Design

Last updated: 2026-05-23

## Purpose

This document defines how Blessing Tree should move from hardcoded campaign milestone and readiness rules to admin-managed milestone definitions and readiness criteria.

The immediate problem is sponsor readiness:

- public sponsor signup can require `sponsor_registration_start`
- public sponsor signup can require `sponsor_registration_end`
- public sponsor signup can require `gift_intake_end`
- those requirements are currently hardcoded in backend constants and readiness functions

That approach works for early delivery, but it does not scale. Campaign operators and admins need a controlled way to define what milestones exist, when they matter, whether missing them blocks a campaign phase, and what other behavior depends on them.

Related designs:

- `docs/engineering/campaign-readiness-design.md`
- `docs/engineering/campaign-schedule-design.md`
- `docs/engineering/campaign-studio-design.md`
- `docs/engineering/campaign-sponsor-workspace-design.md`

Implementation planning lives in:

- `docs/engineering/admin-milestone-readiness-implementation-plan.md`

## Current State

Milestone and readiness definitions are currently split across code:

- `campaign_milestone`
  - stores campaign-specific dated milestone rows
- `MILESTONE_DEFINITIONS`
  - hardcoded catalog of allowed milestone keys and labels
- `REQUIRED_MILESTONE_KEYS`
  - hardcoded general milestone readiness requirements
- `PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS`
  - hardcoded sponsor signup milestone requirements
- `studio_readiness_rules.py`
  - hardcoded rule logic and readiness item messages

This creates a deployment dependency for operational policy changes. Adding a milestone or changing whether a missing milestone is a blocker requires a code change.

## Goals

The new model should:

- let admins manage the global milestone catalog
- let admins define readiness criteria tied to milestone presence
- keep campaign-specific milestone dates owned by each campaign
- keep readiness backend-authoritative
- make blockers visible as explicit readiness rows
- support feature-conditional requirements such as "only required when public sponsor signup is enabled"
- leave room for operational ramifications beyond readiness, such as public flow gating and automation anchoring
- avoid introducing a broad arbitrary rules engine in the first version

## Non-Goals

This design should not:

- make campaign managers define global operational policy
- move readiness evaluation to the frontend
- allow arbitrary executable code in admin-defined rules
- replace campaign-specific validation
- build a fully general workflow/rules engine in v1
- remove the current `campaign_milestone` table

## Product Model

There are three distinct concepts:

1. **Milestone Definition**
   - global admin-owned definition of a kind of milestone
   - example: `Sponsor Registration Starts`

2. **Campaign Milestone**
   - campaign-owned dated instance of a milestone definition
   - example: `Sponsor Registration Starts` occurs on `2026-10-01` for one campaign

3. **Readiness Rule**
   - admin-owned rule that says what readiness finding should exist when a milestone condition is not satisfied
   - example: when public sponsor signup is enabled and `Sponsor Registration Starts` is missing, emit an error blocker for `activate` and `operations`

## Design Principles

1. Keep definitions global and dates campaign-specific.
2. Keep rule conditions constrained and inspectable.
3. Store messages and routing in the rule so admins can control operator-facing wording.
4. Preserve stable rule keys so tests, AI drafts, and support tooling can reason about findings.
5. Seed the current hardcoded behavior into database definitions before removing hardcoded constants.
6. Prefer explicit rows over opaque JSON when the value is queried, sorted, filtered, or edited in admin screens.
7. Allow JSON only for constrained condition details and future extension points.

## Data Model

## Milestone Definition

Add a global `campaign_milestone_definition` table.

Recommended fields:

- `id`
- `milestone_key`
- `label`
- `description`
- `feature_area`
- `default_sort_order`
- `is_active`
- `is_system`
- `created_at`
- `updated_at`

### Field Notes

#### `milestone_key`

Stable machine key.

Examples:

- `registration_open`
- `registration_close`
- `sponsor_registration_start`
- `sponsor_registration_end`
- `gift_intake_end`

Constraints:

- unique
- lowercase letters, numbers, and underscores
- should not be reused for a different operational meaning

#### `feature_area`

Recommended initial values:

- `GENERAL`
- `RECIPIENTS`
- `SPONSORS`
- `GIFTS`
- `PICKUP`
- `COMMUNICATIONS`

This is for admin organization and UI grouping. It should not by itself make a milestone required.

#### `is_system`

System definitions are seeded by migrations and may be protected from deletion. Admins may still edit labels/descriptions if desired, but changing `milestone_key` should be blocked once used.

## Campaign Milestone

Keep the existing `campaign_milestone` table as the campaign-specific date source of truth.

Recommended evolution:

- keep `milestone_key` for compatibility
- optionally add `milestone_definition_id`
- continue enforcing one row per campaign and milestone key

V1 can keep `milestone_key` only, as long as APIs validate against active milestone definitions from the database.

## Readiness Rule Definition

Add a global `campaign_readiness_rule_definition` table.

Recommended fields:

- `id`
- `rule_key`
- `name`
- `description`
- `rule_type`
- `feature_area`
- `condition_type`
- `condition_config_json`
- `milestone_key`
- `severity`
- `category`
- `blocking_for_json`
- `section`
- `action_label`
- `message`
- `is_active`
- `is_system`
- `created_at`
- `updated_at`

### Field Notes

#### `rule_key`

Stable machine key for the readiness item.

Examples:

- `missing_public_sponsor_registration_start`
- `missing_public_sponsor_registration_end`
- `missing_public_sponsor_gift_turn_in`
- `missing_campaign_registration_open`

#### `rule_type`

Initial supported value:

- `MISSING_MILESTONE`

Future values may include:

- `MILESTONE_OUT_OF_RANGE`
- `MILESTONE_ORDER_INVALID`
- `MISSING_COMMUNICATION_SCHEDULE`
- `MISSING_TEMPLATE`
- `FEATURE_HEALTH`

#### `condition_type`

Initial supported values:

- `ALWAYS`
- `CAMPAIGN_FIELD_TRUE`
- `CAMPAIGN_STATUS_IS`
- `FEATURE_ENABLED`

For the sponsor rules:

- `condition_type = CAMPAIGN_FIELD_TRUE`
- `condition_config_json = {"field": "public_sponsor_signup_enabled"}`

This avoids arbitrary expression parsing while still covering the current need.

#### `milestone_key`

Used by `MISSING_MILESTONE` rules to identify the milestone that must exist for a campaign.

#### `severity`

Allowed values:

- `error`
- `warning`
- `info`

#### `category`

Allowed values should match Campaign Readiness:

- `blockers`
- `launch_checks`
- `planning_gaps`
- `operational_health`

#### `blocking_for_json`

JSON array of lifecycle phases:

- `draft`
- `activate`
- `operations`
- `close`

For sponsor public signup milestones:

```json
["activate", "operations"]
```

#### `section`

The Studio section where the operator can fix the finding.

Initial values should match the frontend section ids where possible:

- `settings`
- `team`
- `communications`
- `schedule`
- `readiness`

Sponsor milestone blockers should route to `schedule`, because the fix is adding milestone dates.

## Rule Evaluation

The readiness service should continue to orchestrate rule families, but milestone-driven rules should come from the database.

Recommended evaluator flow:

1. Load campaign.
2. Load campaign milestone rows.
3. Load active milestone definitions.
4. Load active readiness rule definitions.
5. Evaluate code-based rules that are still not configurable.
6. Evaluate configured milestone rules.
7. Merge all readiness items.
8. Build grouped response and phase status using the existing readiness response shape.

## Missing Milestone Rule Behavior

For each active `MISSING_MILESTONE` rule:

1. Evaluate the condition.
2. If the condition is false, emit no readiness item.
3. If the condition is true, check whether the campaign has a `campaign_milestone` row for `milestone_key`.
4. If no row exists, emit a readiness item from the rule definition.
5. If a row exists, emit no readiness item.

Important:

- A milestone row means the milestone exists.
- `occurs_on` is required, so a saved row means the date is present.
- Future rule types can validate sequencing and date ranges.

## Ramifications Beyond Readiness

Readiness rules answer "what is missing or blocking?"

Some milestones also drive runtime behavior. These dependencies should be represented explicitly instead of inferred from readiness severity.

Add a future optional `milestone_usage` model or table when needed.

Recommended initial shape:

- `id`
- `milestone_key`
- `usage_type`
- `feature_area`
- `required_condition_type`
- `required_condition_config_json`
- `description`
- `is_active`

Initial `usage_type` values:

- `PUBLIC_FLOW_WINDOW_START`
- `PUBLIC_FLOW_WINDOW_END`
- `PUBLIC_FLOW_DEADLINE_MESSAGE`
- `COMMUNICATION_ANCHOR`
- `AUTOMATION_ANCHOR`

Sponsor examples:

- `sponsor_registration_start`
  - `PUBLIC_FLOW_WINDOW_START`
- `sponsor_registration_end`
  - `PUBLIC_FLOW_WINDOW_END`
- `gift_intake_end`
  - `PUBLIC_FLOW_DEADLINE_MESSAGE`

V1 does not need a full usage table if that would slow delivery. It should, however, keep runtime dependencies explicit in service code and not treat readiness rules as the only source of runtime behavior.

## Admin UX

Add an admin section for operational configuration.

Recommended navigation:

- `Admin > Campaign Operations`
  - `Milestones`
  - `Readiness Rules`

### Milestones Tab

The Milestones tab should let app admins:

- view active and inactive milestone definitions
- add a milestone definition
- edit label, description, feature area, sort order, and active state
- see whether the milestone is referenced by readiness rules
- protect system keys from unsafe deletion

Recommended columns:

- Label
- Key
- Feature Area
- Default Order
- Active
- System
- Readiness Rules

### Readiness Rules Tab

The Readiness Rules tab should let app admins:

- view active readiness rules
- create/edit `MISSING_MILESTONE` rules
- choose the milestone definition
- choose condition type
- choose severity/category/blocking phases
- choose the Studio action section
- edit the operator-facing message
- enable/disable rules

Recommended columns:

- Name
- Rule Key
- Type
- Feature Area
- Condition
- Severity
- Category
- Blocks
- Active

### Rule Editor

For v1, the editor should be form-driven and constrained.

Fields:

- Rule Name
- Rule Key
- Rule Type
- Milestone
- Condition Type
- Condition Config
- Severity
- Category
- Blocking Phases
- Studio Section
- Action Label
- Message
- Active

For `CAMPAIGN_FIELD_TRUE`, the condition field should be selected from an allowlist, not freeform text.

Initial allowlist:

- `public_sponsor_signup_enabled`

## API Shape

Recommended admin endpoints:

- `GET /api/v1/admin/campaign-operations/milestone-definitions`
- `POST /api/v1/admin/campaign-operations/milestone-definitions`
- `PATCH /api/v1/admin/campaign-operations/milestone-definitions/<id>`
- `GET /api/v1/admin/campaign-operations/readiness-rules`
- `POST /api/v1/admin/campaign-operations/readiness-rules`
- `PATCH /api/v1/admin/campaign-operations/readiness-rules/<id>`

Recommended support endpoint:

- `GET /api/v1/admin/campaign-operations/readiness-rule-options`

Options payload should include:

- allowed rule types
- allowed condition types
- allowed campaign fields
- allowed severities
- allowed categories
- allowed lifecycle phases
- allowed Studio sections
- active milestone definitions

Campaign Studio milestone APIs should continue to use:

- `GET /api/v1/campaigns/<campaign_id>/milestones`
- `PUT /api/v1/campaigns/<campaign_id>/milestones`

But validation should use active database milestone definitions instead of hardcoded `MILESTONE_DEFINITIONS`.

## Seeded Defaults

The migration should seed the current hardcoded milestone catalog.

Initial milestone definitions:

- `registration_open`
- `registration_close`
- `sponsor_registration_start`
- `sponsor_registration_end`
- `sponsor_outreach_start`
- `gift_intake_start`
- `gift_intake_end`
- `pickup_start`
- `pickup_end`
- `campaign_close`

Initial readiness rules should preserve current behavior:

- general required milestone warning
  - one rule per general required milestone, or one compatibility rule that emits individual findings
- public sponsor signup blockers:
  - missing sponsor registration start
  - missing sponsor registration end
  - missing gift turn-in deadline

Recommended sponsor rule seeds:

| Rule Key | Milestone | Condition | Severity | Category | Blocks |
| --- | --- | --- | --- | --- | --- |
| `missing_public_sponsor_registration_start` | `sponsor_registration_start` | `public_sponsor_signup_enabled == true` | `error` | `blockers` | `activate`, `operations` |
| `missing_public_sponsor_registration_end` | `sponsor_registration_end` | `public_sponsor_signup_enabled == true` | `error` | `blockers` | `activate`, `operations` |
| `missing_public_sponsor_gift_turn_in` | `gift_intake_end` | `public_sponsor_signup_enabled == true` | `error` | `blockers` | `activate`, `operations` |

## Permission Model

Use app-admin permissions for global definitions.

Recommended behavior:

- app admins can create/edit/deactivate milestone definitions and readiness rules
- campaign managers can only set campaign milestone dates
- campaign viewers can only view readiness output

Deletion should be conservative:

- system definitions should not be physically deleted
- definitions referenced by campaign milestones or rules should be deactivated, not deleted

## Migration Strategy

The migration should be additive.

1. Create definition tables.
2. Seed current milestone definitions.
3. Seed current configurable readiness rules.
4. Keep current hardcoded constants temporarily as fallback.
5. Change validation and readiness evaluation to read database definitions.
6. Remove or narrow hardcoded constants after parity tests pass.

## Testing Strategy

Backend tests should cover:

- seeded milestone definitions exist
- admin can create/edit/deactivate a custom milestone definition
- campaign milestone validation accepts active database definitions
- inactive milestone definitions cannot be used for new campaign milestones
- readiness emits a blocker when an enabled rule's milestone is missing
- readiness emits no item when the milestone exists
- readiness emits no item when the rule condition is false
- sponsor signup enabled produces the three expected blockers when all three milestones are missing

Frontend tests should cover:

- admin milestone table renders definitions
- admin can create/edit a milestone definition
- readiness rule table renders rule metadata
- admin can create/edit a missing-milestone readiness rule
- Campaign Studio shows configured readiness messages

## Open Questions

1. Should admins be allowed to create completely custom `feature_area` values, or should feature areas be an enum?
   - Recommendation: enum in v1.

2. Should campaign managers be able to request new milestone definitions from Campaign Studio?
   - Recommendation: not in v1. Keep global policy app-admin owned.

3. Should general required milestones remain grouped as one warning or become one row per missing milestone?
   - Recommendation: one row per missing milestone for visibility and consistency.

4. Should rule conditions support multiple clauses?
   - Recommendation: not in v1. Add only after concrete use cases require it.

5. Should readiness rules drive runtime gating directly?
   - Recommendation: no. Runtime gating should use explicit service logic or a future `milestone_usage` model.
