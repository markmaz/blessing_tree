# Campaign Schedule Design

## Status

- Proposed and accepted for implementation on 2026-05-20

## Purpose

Campaign managers need a real planning surface, not just milestone fields.

They need to:

- see the campaign chronologically
- place milestone events on a visible plan
- add manual planning events
- see communications alongside milestones
- understand gaps, overlap, and upcoming deadlines

This design makes `Schedule` a first-class Campaign Studio section and introduces a unified schedule model that supports both system-derived and manual campaign events.

## Summary

Campaign Studio should replace the current `Dates` section with `Schedule`.

The `Schedule` section should provide three coordinated views:

- `Timeline`
- `Calendar`
- `Milestones`

The first implementation should also add a new `campaign_event` model so campaign managers can plan manual events now rather than waiting for a later phase.

The schedule should unify three sources:

- milestone-derived events
- communication-derived events
- manual campaign events

Milestones and communication schedules remain their own source-of-truth records.

Manual campaign events become their own editable planning records.

## Product Decision

The need for manual planning events already exists, so the backend event model should be implemented now rather than deferred.

## Design Goals

### One Schedule Surface

Campaign managers should not need one page for milestone editing and another page for calendar planning.

The schedule surface should show:

- what is already planned
- what is missing
- what happens next

### Derived And Manual Events Together

Milestones and communication schedules already express important timing.

The schedule should display them together with manual events so the campaign plan can be understood in one place.

### Source Of Truth Stays Clear

Manual events should be directly editable in the schedule.

Milestone-derived and communication-derived events should be visible there, but edits to them should route back to their source forms rather than duplicating state.

### Campaign Manager Oriented

The schedule is primarily an operator planning surface for users with `campaign.admin`.

Read-only users may still view it if they have `campaign.view`, but editing is manager/admin behavior.

## Studio UX

### Left Rail

Rename the existing `Dates` section to `Schedule`.

Recommended left-rail order:

- Overview
- Team
- Communications
- Schedule
- Readiness
- Settings

### Section Layout

The `Schedule` section should include a top-level tab or segmented control:

- `Timeline`
- `Calendar`
- `Milestones`

Recommended default tab:

- `Timeline`

### Timeline View

This is the primary planning surface.

It should show events in chronological order with:

- title
- date or date range
- event type
- source badge
- short notes if present

Recommended event/source badges:

- `Milestone`
- `Communication`
- `Manual`

The timeline should make it easy to spot:

- missing milestone coverage
- clustered deadlines
- upcoming tasks
- long gaps

### Calendar View

This is the spatial date-planning surface.

V1 should use a month-style calendar.

It should show:

- milestone events
- scheduled communications
- manual events

Clicking an event should open lightweight detail in place.

Manual events should expose edit/delete actions.

Derived events should expose an action like:

- `Edit milestone`
- `Edit communication`

### Milestones View

This remains the structured edit surface for named campaign milestones.

The existing milestone form can stay as the authoritative edit UI in v1.

## Data Model

### Existing Data Sources

Existing schedule-relevant models already include:

- `campaign`
- `campaign_milestone`
- `campaign_communication_schedule`

### New Model: `campaign_event`

Add a new table for manual planning events.

Recommended fields:

- `id`
- `campaign_id`
- `title`
- `event_type`
- `start_at`
- `end_at`
- `all_day`
- `notes`
- `source_type`
- `source_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

### Field Notes

#### `event_type`

Use an explicit typed value, not freeform categories in v1.

Recommended initial values:

- `GENERAL`
- `VOLUNTEER`
- `SPONSOR`
- `DONATION`
- `RECIPIENT`
- `GIFT`
- `PICKUP`
- `COMMUNICATION`
- `MILESTONE`

Only manual events will normally use operator-selected types.

Derived events can map their source into these types automatically.

#### `source_type`

Recommended values:

- `manual`
- `milestone`
- `communication`

#### `source_id`

- nullable for `manual`
- references the originating record for derived events

### Derived Event Rules

The unified schedule response should include derived schedule items from:

- milestone rows
- communication schedule rows

Those derived items do not need to be persisted into `campaign_event`.

They can be materialized in the service layer.

That avoids synchronization problems and duplicated truth.

### Manual Event Rules

Only manual events are stored in `campaign_event`.

Only manual events are editable through the schedule event CRUD endpoints.

## Persistence Decision

Do not persist milestone-derived or communication-derived events into `campaign_event`.

Persist only manual schedule entries there.

Rationale:

- keeps source-of-truth clean
- avoids sync/rebuild problems
- allows the unified schedule service to stay deterministic

## Database Constraints

Recommended constraints and indexes:

- primary key on `id`
- foreign key `campaign_id -> campaign.id`
- foreign key `created_by_user_id -> app_user.id`
- index `(campaign_id, start_at)`
- index `(campaign_id, event_type)`
- index `(campaign_id, source_type)`
- optional uniqueness on `(campaign_id, source_type, source_id)` only if later we choose to persist derived events, which v1 should not do

## API Design

Base path:

- `/api/v1/campaigns/<campaign_id>`

### 1. Unified Schedule Read

- `GET /schedule`

Purpose:

- return a normalized event stream for timeline/calendar rendering

Access:

- `campaign.view`

Response shape:

```json
{
  "campaign_id": "uuid",
  "items": [
    {
      "id": "manual-event-id",
      "title": "Volunteer Orientation",
      "event_type": "VOLUNTEER",
      "source_type": "manual",
      "source_id": null,
      "start_at": "2026-11-10T18:00:00Z",
      "end_at": "2026-11-10T19:30:00Z",
      "all_day": false,
      "notes": "Walk through intake and pickup flow.",
      "is_editable": true
    },
    {
      "id": "milestone:registration_open",
      "title": "Registration Opens",
      "event_type": "MILESTONE",
      "source_type": "milestone",
      "source_id": "milestone-uuid",
      "start_at": "2026-10-15T00:00:00Z",
      "end_at": null,
      "all_day": true,
      "notes": null,
      "is_editable": false
    }
  ]
}
```

### 2. Manual Event List

- `GET /events`

Purpose:

- return persisted manual campaign events only

Access:

- `campaign.view`

### 3. Create Manual Event

- `POST /events`

Purpose:

- create a manual planning event

Access:

- `campaign.admin`

Request:

```json
{
  "title": "Volunteer Orientation",
  "event_type": "VOLUNTEER",
  "start_at": "2026-11-10T18:00:00Z",
  "end_at": "2026-11-10T19:30:00Z",
  "all_day": false,
  "notes": "Walk through intake and pickup flow."
}
```

### 4. Update Manual Event

- `PATCH /events/<event_id>`

Purpose:

- update a manual event

Access:

- `campaign.admin`

### 5. Delete Manual Event

- `DELETE /events/<event_id>`

Purpose:

- remove a manual event

Access:

- `campaign.admin`

Behavior:

- hard delete is acceptable for manual planning events in v1 because these are campaign-local schedule records, not canonical business entities like campaigns themselves

## Validation Rules

### Required

- `title`
- `event_type`
- `start_at`

### Optional

- `end_at`
- `all_day`
- `notes`

### Rules

- `end_at` must be `>= start_at` when present
- `title` should be short and operator-friendly
- `notes` should be optional and bounded
- all-day events should normalize to a date-oriented display

## RBAC Rules

### Read

- unified schedule read: `campaign.view`
- manual event list: `campaign.view`

### Write

- create/update/delete manual events: `campaign.admin`

### Derived Edits

Derived schedule items should not be editable through event endpoints.

Instead:

- milestone-derived items route back to milestone editing
- communication-derived items route back to communication editing

## Frontend Design

### Section Rename

Rename:

- `Dates` -> `Schedule`

### Frontend State

Add a unified schedule data shape for:

- `items`
- active schedule view
- selected event

### Timeline Rendering

Recommended v1 rendering:

- vertical grouped list by month
- event rows/cards with source badges
- highlight the next upcoming event

### Calendar Rendering

Recommended v1 rendering:

- month grid
- compact event chips per day
- overflow indicator when a day has many entries

### Milestone Editor

Reuse the current milestone form under the `Milestones` tab.

### Manual Event Creation UI

V1 should support a simple inline or modal form with:

- title
- type
- start date/time
- end date/time
- all-day
- notes

## Readiness Interaction

Schedule should feed readiness.

Examples:

- no key milestones set
- no manual planning events before launch
- no communication schedule near important milestones

Readiness can initially continue using milestone/schedule data, but later may also consider manual events.

## AI Interaction

The AI rail should eventually be able to suggest schedule entries such as:

- “Add volunteer orientation two weeks before gift intake”
- “Place sponsor reminder three days before outreach start”
- “Add pickup weekend planning block”

AI-generated schedule suggestions should remain draft proposals until approved by the user.

## Implementation Plan

### Phase 1

- add `campaign_event` migration
- add SQLAlchemy model
- add validation and service layer
- add schedule read endpoint
- add manual event CRUD endpoints

### Phase 2

- rename Studio `Dates` section to `Schedule`
- add `Timeline | Calendar | Milestones` tabs
- render unified schedule from milestone + communication + manual event data
- keep current milestone editor as the `Milestones` tab

### Phase 3

- add manual event create/edit/delete UI
- connect schedule items to readiness and AI suggestions

## Non-Goals For V1

Do not implement yet:

- recurring event rules
- drag-and-drop calendar editing
- external calendar sync
- ICS export/import
- per-user personal schedules
- generalized event workflow automation

## Recommendation

Implement `Schedule` now as a real campaign planning surface, not a renamed milestone form.

That means:

- add `campaign_event` now
- unify derived and manual schedule items in one read model
- make `Timeline` the primary view
- make `Calendar` the secondary visual view
- keep `Milestones` as the structured source edit view
