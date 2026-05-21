# Campaign Studio Design

Last updated: 2026-05-20

## Purpose

Campaign Studio is the primary operator-facing surface for building and managing a campaign.

It should let a user:

- understand the full campaign in one view
- add and edit the major campaign building blocks
- see missing setup areas quickly
- use AI to draft or refine campaign structure
- move from summary into detail without losing context

This is not a plain CRUD page.

It should borrow the interaction model of Query Forge Workflow Studio:

- visible central working surface
- persistent side tools
- composable cards
- AI helper rail

It should not borrow the workflow graph metaphor itself.

## Core Product Idea

Campaign Studio is a structured campaign builder.

The campaign is represented as a set of operational cards that together describe the season:

- campaign metadata
- team and assignments
- communication templates and schedules
- milestone dates
- readiness and gaps

The user should be able to see those parts together on one screen and progressively build them out.

## Design Principles

### One-View Comprehension

The user should be able to open a campaign and understand:

- what the campaign is
- who is running it
- what communications exist
- what dates matter
- what is still missing

without opening multiple disconnected pages first.

### Cards Over Forms

The main studio surface should be card-based.

Cards are easier to scan, easier to extend, and closer to the “visible representation” goal than a long settings form.

### AI Assists Structure

AI should help create or refine structured campaign elements.

AI should not be a separate novelty panel with no connection to the studio state.

Its job is to propose updates to cards and sections the user can accept or reject.

### Human Approval Required

AI may draft or suggest changes.

Humans approve application of those changes.

## V1 Scope

Campaign Studio v1 should focus on:

- a visible studio shell
- campaign overview cards
- team cards
- communications cards
- milestone/date cards
- readiness cards
- AI builder rail

V1 should not attempt to cover every downstream domain area in full detail.

## Route Shape

Primary route:

- `/campaigns/:campaignId/studio`

Supporting routes may still exist:

- `/campaigns`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/access`
- `/campaigns/:campaignId/settings`

Recommendation:

- make `/campaigns/:campaignId/studio` the canonical operator workspace
- keep `/campaigns/:campaignId` as a lighter detail entry point if needed

## Layout

Campaign Studio should use a three-region layout.

### Left Rail

Purpose:

- section navigation
- quick status markers
- campaign-level shortcuts

Recommended sections:

- Overview
- Team
- Communications
- Schedule
- Readiness
- Settings

Future sections may expand into:

- Recipients
- Wishlists
- Donations
- Sponsors
- Gifts
- Pickups
- Reports

Schedule is now further specified in:

- `docs/engineering/campaign-schedule-design.md`

Studio AI actions are now further specified in:

- `docs/engineering/campaign-studio-ai-actions-design.md`

Readiness is now further specified in:

- `docs/engineering/campaign-readiness-design.md`

### Center Work Surface

Purpose:

- visible campaign representation
- card grid or card stacks
- section-specific editing surface

This is the main studio canvas.

It is not a graph.

It is a structured composition area made of cards and card groups.

### Right AI Rail

Purpose:

- prompt-driven campaign building help
- suggested changes
- draft application actions
- guidance and readiness hints

This rail should remain visible and useful even when the user is not actively typing.

## Default Studio View

When the user lands on the studio, the default section should be `Overview`.

The Overview should show the full campaign at a glance.

Recommended card groups:

### Campaign Identity

Fields:

- campaign name
- description
- year
- lifecycle status
- primary season window

Actions:

- edit metadata
- change status

### Team Snapshot

Fields:

- campaign managers
- coordinators
- volunteers
- assignment counts by role

Actions:

- add manager
- add volunteer
- open role assignments

### Communications Snapshot

Fields:

- number of mail templates
- upcoming scheduled sends
- missing template warnings

Actions:

- add template
- schedule email

### Dates And Milestones

Fields:

- registration start
- sponsor outreach start
- gift intake start/end
- pickup windows
- close/archive targets

Actions:

- edit dates
- add milestone

### Readiness

Fields:

- missing manager
- no volunteers assigned
- no email templates
- key dates missing
- campaign still in draft

Actions:

- jump to affected section

## Card Model

Cards should be the visible representation of campaign structure.

### V1 Card Types

#### Campaign Setup Card

Represents:

- identity and lifecycle

Contains:

- name
- description
- year
- status
- start date
- end date

#### Team Card

Represents:

- who runs the campaign

Contains:

- campaign managers
- coordinators
- volunteers
- role counts

#### Communication Card

Represents:

- reusable campaign communication assets

Contains:

- template name
- channel
- audience
- status
- linked schedule count

#### Schedule Card

Represents:

- timed campaign communications

Contains:

- linked template
- intended audience
- scheduled send date
- trigger or milestone

#### Milestone Card

Represents:

- important campaign dates

Contains:

- milestone type
- date
- notes

#### Readiness Card

Represents:

- validation output

Contains:

- status
- missing requirement
- suggested fix
- quick link

## Team Design

Team setup is a first-class campaign-building concern, not a hidden admin task.

### Team Workspace Direction

The original role-assignment-only Team model is no longer sufficient.

Campaign Team is now further specified in:

- `docs/engineering/campaign-team-design.md`

Studio should treat Team as:

- a campaign roster workspace
- optional app-access management
- access-role management
- team/group management

not just a thin assignment form.

## Communication Design

Communications should be visible in the studio because they are part of campaign readiness.

### Template Strategy

Recommendation:

- campaign-scoped templates

Meaning:

- templates are reusable assets
- campaigns link to and configure the templates they use
- campaign-specific schedules and dates live within the campaign context

This avoids duplicating template content per campaign while still letting the campaign own timing and usage.

### V1 Communication Capabilities

Campaign Studio should allow:

- attach template to campaign
- view template usage in campaign
- define send schedule/date
- associate schedule with milestone or fixed date

### Example Template Uses

- sponsor invitation
- sponsor reminder
- volunteer onboarding
- pickup reminder
- thank-you email

## Milestones And Dates

Recommendation:

- use fixed named milestone fields in v1
- do not begin with a fully flexible timeline engine

Suggested v1 milestones:

- registration opens
- registration closes
- sponsor outreach starts
- gift intake starts
- gift intake ends
- sorting/prep starts
- pickup weekend start
- pickup weekend end

This can later evolve into a more flexible typed milestone model if needed.

## AI Builder Rail

The AI rail should behave like a campaign-building copilot, not a chat widget floating beside the app.

### Primary AI Jobs

- draft a new campaign structure from a prompt
- suggest roles the campaign still needs
- suggest milestone dates
- suggest template inventory
- suggest readiness checklist items
- refine descriptions or communication copy

### Example Prompts

- "Build a 2027 east campus blessing tree campaign."
- "Add a volunteer intake and training plan."
- "Suggest sponsor reminder emails and their dates."
- "What is missing before this campaign can be activated?"

### AI Output Shape

AI responses should map to structured studio changes such as:

- create card
- update card fields
- suggest milestone
- suggest template binding
- add readiness warning

### Apply Model

Recommendation:

- AI drafts changes
- user reviews them
- user explicitly applies them

No direct silent mutation of campaign state.

## Visual Direction

The studio should feel more like a planning surface than a table-heavy admin page.

Recommended characteristics:

- card grid with strong section groupings
- warm but operational palette aligned with existing Blessing Tree styling
- visible hierarchy between campaign summary and editable building blocks
- right-side AI rail that feels integrated, not bolted on

The center should feel like a campaign board.

## Backend Implications

Current campaign endpoints are not sufficient for full studio behavior.

Additional backend support will be needed.

### Required Next APIs

#### Team Management

- member list and member detail
- member create and update
- team list and team create/update
- team membership create/remove
- member access-role assignment management
- app-access linking and invitation flows

#### Communication Templates

- list available templates
- attach template to campaign
- detach template from campaign

#### Communication Schedules

- create campaign communication schedule
- update schedule
- list schedules by campaign

#### Milestones

- get campaign milestone set
- update campaign milestone set

#### Readiness

- compute campaign readiness
- return warnings/errors/checklist items

#### AI Draft Support

- draft structured campaign changes from prompt
- apply accepted structured draft

## Frontend Implementation Plan

### Phase 1

Build the shell:

- `/campaigns/:campaignId/studio`
- left rail
- center layout
- right AI rail placeholder

Use existing campaign detail, access, and summary endpoints.

### Phase 2

Build the overview cards:

- campaign setup
- team snapshot
- communications snapshot
- milestones snapshot
- readiness snapshot

### Phase 3

Add team management workflows:

- add manager
- add volunteer
- assignment editing

### Phase 4

Add communications and milestone editing:

- template bindings
- email schedules
- date configuration

### Phase 5

Add AI structured drafting:

- prompt panel
- proposal list
- accept/reject/apply flow

## Non-Goals For V1

- no graph canvas
- no drag-and-drop workflow editor
- no generalized automation builder
- no fully dynamic permissions editor inside the studio
- no custom campaign schema builder

## Decisions Locked By This Design

- Campaign Studio is a card-based composition surface.
- The main studio route should be `/campaigns/:campaignId/studio`.
- Team setup is first-class in the studio.
- Communications are visible and managed in the studio.
- Milestones use fixed named fields in v1.
- AI proposes structured campaign changes and humans approve apply.
- Mail templates should be campaign-scoped so a campaign can clone, tailor, and own its own communication set.
- Team should evolve into a roster-plus-access-plus-teams workspace, not stay a role-assignment-only editor.

## Recommended Next Step

Build the Campaign Studio shell before deeper domain APIs.

That means:

1. add the studio route
2. create the three-region layout
3. render the overview cards from existing campaign/access/summary data
4. stub the AI rail and card actions

That gives the project a real visible campaign-building surface early, even before all underlying domain editing APIs are complete.
