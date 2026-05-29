# Campaign Calendar Intelligence Design

## Status

Implemented on branch `codex/calendar-intelligence`.

The core feature is now built across the backend, Campaign Studio Schedule, Ask Blessing Tree, and the Dashboard. No database migration was required because calendar intelligence is a read model over existing campaign, milestone, schedule, communication, sponsorship, and sponsor interaction records.

## Purpose

Campaign Studio already has a working schedule surface where managers can add milestones, manual events, and scheduled communications. What is still missing is the campaign manager's at-a-glance operational view:

- What dates matter most?
- What is overdue?
- What is coming up soon?
- What dates block readiness?
- What communications are scheduled?
- What sponsor follow-ups or gift deadlines need attention?
- What is missing from the campaign plan?

This design adds a shared campaign calendar intelligence layer that powers:

- a visual Campaign Studio calendar overview
- Ask Blessing Tree answers about campaign dates and timing
- a Dashboard calendar attention widget

The goal is not to replace the existing editable calendar. The goal is to add a compact, holistic view above it and make the same data available conversationally.

## Product Summary

Add a new `Calendar Overview` experience inside Campaign Studio Schedule.

The Schedule section should become:

1. Calendar intelligence summary
2. Condensed critical date strip
3. Agenda grouped by urgency
4. Existing large editable calendar

The Dashboard also shows an `Upcoming Calendar` widget with the next scheduled campaign dates and events.

Ask Blessing Tree should use the same backend calendar intelligence service to answer natural language questions such as:

- "What is overdue?"
- "What is coming up this week?"
- "Are we missing any important dates?"
- "What blocker dates are not set?"
- "When does sponsor recruitment start?"
- "What communications are scheduled?"
- "Who has a sponsor follow-up due?"
- "What needs attention before pickup?"
- "Are there dates outside the campaign window?"

## Design Principles

### One Source Of Calendar Truth

Do not create separate logic for the visual calendar and Ask Blessing Tree.

Build one backend service that gathers, classifies, and summarizes campaign date signals. Then surface that service in:

- Campaign Studio UI
- Ask Blessing Tree report/query execution
- Dashboard widgets
- future reports

### Keep Source Records Clear

The intelligence service should aggregate existing source records. It should not duplicate them into another permanent table.

Existing source records remain authoritative:

- campaign setup dates
- campaign milestones
- manual campaign events
- communication schedules
- sponsor drop-off due dates
- sponsor interaction follow-up dates
- gift workflow dates when available

### Calendar Overview Is Operational

This should feel like a campaign manager's command center, not just another calendar widget.

The first screen should answer:

- What is urgent?
- What is missing?
- What is next?
- What should I click into?

### Ask Should Answer, Not Navigate First

For date questions, Ask Blessing Tree should answer directly with the relevant dates, counts, and links. It should not simply tell the user to open Campaign Studio unless the user asks where to edit the information.

## Existing Foundation

The current schedule implementation already provides:

- manual campaign events through `campaign_event`
- milestone-derived schedule items
- communication-derived schedule items
- `GET /api/v1/campaigns/<campaign_id>/schedule`
- manual event CRUD endpoints
- a large editable calendar in `CampaignStudioScheduleSection`

The new work should extend this foundation rather than replacing it.

## Calendar Intelligence Sources

### Campaign Setup Dates

Source:

- `campaign.start_date`
- `campaign.end_date`
- sponsor recruitment dates if present on campaign/settings

Use cases:

- show campaign bounds
- identify dates outside the campaign window
- answer campaign start/end questions

### Milestones

Source:

- `campaign_milestone`
- `campaign_milestone_definition`

Use cases:

- critical date strip
- blocker detection
- missing required date detection
- readiness explanations

Milestones should carry:

- label
- date
- blocker flag from definition/rule metadata where available
- category
- status: missing, upcoming, due soon, overdue, complete/not applicable

### Manual Campaign Events

Source:

- `campaign_event`

Use cases:

- show operational planning events
- include volunteer orientation, wrapping day, pickup planning, distribution, etc.

### Scheduled Communications

Source:

- `campaign_communication_schedule`
- linked template
- linked milestone when scheduled relative to a milestone

Use cases:

- answer "what emails are scheduled?"
- show communications in agenda
- warn about disabled/draft schedules

### Sponsor Drop-Off Dates

Source:

- `sponsorship.drop_off_due_at`
- `sponsorship.drop_off_completed_at`
- sponsorship/gift status

Use cases:

- summarize overdue sponsor gift turn-ins
- show count-based agenda items instead of flooding the calendar with one item per sponsor
- allow drill-down to Sponsor reports or Sponsor Directory

Recommended aggregation:

- if 1-5 sponsors due on a date, list individual sponsor names
- if more than 5, show one grouped item such as "18 sponsor drop-offs due"

### Sponsor Follow-Up Dates

Source:

- `sponsor_interaction.follow_up_at`

Use cases:

- show follow-up workload
- answer "who needs follow-up this week?"
- link to Sponsor follow-up queue/report

Recommended aggregation:

- grouped by day
- count and first few sponsor names

### Gift Workflow Dates

Source:

- existing gift workflow statuses
- received/wrapped/ready/distributed dates when available
- future gift turn-in and pickup milestones

Use cases:

- answer operational gift questions
- show pickup/distribution window
- flag gifts not ready before pickup

V1 can use milestone dates and gift status counts. Do not block V1 waiting for every gift status timestamp if not all timestamps exist yet.

## Implemented Behavior

### Backend

Implemented service:

- `blessing-tree-api/app/features/campaigns/calendar_intelligence_service.py`

Implemented endpoint:

- `GET /api/v1/campaigns/<campaign_id>/calendar-intelligence`
- Required capability: `campaign.view`

Implemented dashboard reuse:

- `CampaignService.get_dashboard_widgets()` now includes `calendar_upcoming`
- The widget is generated from `CampaignCalendarIntelligenceService`, not a separate query path

Implemented Ask reuse:

- `AskReportExecutor` uses `CampaignCalendarIntelligenceService`
- `report_catalog.py` includes calendar-specific report metrics
- `classifier.py` includes date, timeline, pickup, recruitment, follow-up, and gift turn-in vocabulary

### Campaign Studio Schedule

The Schedule section now renders:

- summary metric tiles for overdue, due soon, missing dates, and scheduled emails
- warning strip for missing or out-of-window items
- critical date strip
- agenda panels for needs attention, coming up, and missing important dates
- existing editable calendar below the overview

Click behavior:

- existing manual, milestone, and communication schedule items open the existing schedule modal
- missing milestone dates open the milestone editor with the missing milestone preselected
- read-only users can view the overview and calendar but cannot edit

### Dashboard

The Dashboard now includes `Upcoming Calendar`.

It shows:

- count of upcoming calendar items
- next scheduled dates and events from the shared intelligence service
- status labels such as Today, Due Soon, Upcoming, or Future
- an Ask shortcut using: `What is coming up on the campaign calendar?`

### Ask Blessing Tree

Ask can now answer:

- `What is overdue?`
- `What is coming up this week?`
- `What important dates are missing?`
- `What blocker dates are missing?`
- `What emails are scheduled?`
- `When is gift turn-in?`
- `When does sponsor recruitment start?`
- `When is pickup?`
- `Who has follow-up due?`
- `Are there dates outside the campaign window?`

Calendar Ask responses return report-style rows with direct actions back to Campaign Studio.

### Warning Rules

Warnings currently include:

- missing important or blocker dates
- overdue actionable items
- items dated before campaign start or after campaign end

## Normalized Calendar Intelligence Model

Create a backend read model, not necessarily a DB table:

```json
{
  "campaign_id": "uuid",
  "generated_at": "2026-05-29T12:00:00Z",
  "summary": {
    "total_items": 42,
    "overdue_count": 3,
    "due_soon_count": 8,
    "missing_critical_dates_count": 2,
    "scheduled_communications_count": 4
  },
  "critical_dates": [
    {
      "key": "sponsor_recruitment_start",
      "label": "Sponsor Recruitment Starts",
      "date": "2026-11-01",
      "status": "upcoming",
      "is_blocker": true,
      "source_type": "milestone",
      "source_id": "uuid",
      "edit_route": "/campaigns/{campaign_id}/studio/schedule"
    }
  ],
  "agenda_groups": [
    {
      "key": "overdue",
      "label": "Overdue",
      "items": []
    },
    {
      "key": "next_7_days",
      "label": "Next 7 Days",
      "items": []
    },
    {
      "key": "next_30_days",
      "label": "Next 30 Days",
      "items": []
    },
    {
      "key": "missing",
      "label": "Missing Important Dates",
      "items": []
    }
  ],
  "items": [
    {
      "id": "milestone:uuid",
      "title": "Gift Turn-In Due",
      "description": "Sponsors should turn in gifts by this date.",
      "item_type": "milestone",
      "urgency": "due_soon",
      "date": "2026-12-10",
      "starts_at": "2026-12-10T00:00:00",
      "ends_at": null,
      "all_day": true,
      "is_blocker": true,
      "is_missing": false,
      "is_overdue": false,
      "count": null,
      "source_type": "milestone",
      "source_id": "uuid",
      "route_name": "campaign_studio_schedule"
    }
  ],
  "warnings": [
    {
      "code": "missing_sponsor_recruitment_start",
      "message": "Sponsor recruitment start date is not set.",
      "severity": "blocker"
    }
  ]
}
```

## Item Types

Recommended `item_type` values:

- `campaign_date`
- `milestone`
- `manual_event`
- `communication`
- `sponsor_dropoff`
- `sponsor_followup`
- `gift_workflow`
- `readiness_blocker`
- `missing_date`

## Urgency Rules

Use a deterministic urgency classifier:

- `missing`: required/important date has no date value
- `overdue`: date is before today and incomplete/actionable
- `today`: date is today
- `due_soon`: date is within 7 days
- `upcoming`: date is within 30 days
- `future`: date is later than 30 days
- `complete`: date is done/completed
- `informational`: date is not actionable

These labels should be consistent across UI and Ask.

## Critical Date Strip

The top of the Schedule section should show a compact row of the most important campaign dates.

Recommended critical dates:

- Campaign Start
- Sponsor Recruitment Starts
- Sponsor Recruitment Ends
- Gift Turn-In Due
- Wrapping Day / Wrapping Window
- Pickup / Distribution
- Campaign End

Each tile should show:

- label
- date or "Missing"
- status badge
- blocker badge when applicable
- click action to edit the source record

If the date is missing and the milestone is a readiness blocker, the tile should be visually prominent.

## Agenda View

Add a condensed agenda card above the large calendar.

Default groups:

- Needs Attention
- Overdue
- Next 7 Days
- Next 30 Days
- Missing Important Dates

Each agenda row should show:

- icon/type
- title
- date
- status badge
- optional count
- source badge
- click action

Rows should be compact and visually scannable. This is for operators, not a marketing layout.

## Existing Large Calendar

Keep the current large calendar.

Enhancements:

- use the same item color/type system as the overview
- add a filter/toggle row later if needed
- preserve click-to-edit behavior
- continue using the existing schedule modal

Do not replace the large calendar with the overview. The overview is an addition.

## Ask Blessing Tree Integration

Add calendar intelligence as a first-class Ask capability.

### Supported Questions

Ask should answer:

- "What is overdue?"
- "What is coming up this week?"
- "What is coming up in the next 30 days?"
- "What important dates are missing?"
- "What blocker dates are missing?"
- "When is gift turn-in?"
- "When does sponsor recruitment start?"
- "What communications are scheduled?"
- "Who has follow-up due?"
- "What needs my attention before pickup?"
- "Are there dates outside the campaign window?"

### Answer Style

Responses should be direct and user-friendly:

```text
You have 3 overdue items:

1. Gift Turn-In Due was due Dec 10.
2. 4 sponsor follow-ups are overdue.
3. Sponsor recruitment end date is missing.

The biggest blocker is the missing sponsor recruitment end date.
```

Include actions when useful:

- Open Schedule
- Open Readiness
- Open Sponsor Follow-Up Queue
- Open Gift Status

### Ask Architecture

Add date-oriented reports to Ask Blessing Tree through the report execution path or a dedicated calendar query path.

Recommended implementation:

- add `CampaignCalendarIntelligenceService`
- add `AskCalendarExecutor` or extend `AskReportExecutor`
- add report catalog entries for calendar questions
- update classifier/planner examples so date questions route to calendar intelligence

This should avoid hardcoding answer text in the frontend.

## Backend Design

### New Service

Add:

- `app/features/campaigns/calendar_intelligence_service.py`

Responsibilities:

- load campaign date signals
- normalize them into calendar intelligence items
- classify urgency
- group agenda items
- produce summary counts
- produce warnings/missing-date records

### API Endpoint

Add:

- `GET /api/v1/campaigns/<campaign_id>/calendar-intelligence`

Access:

- `campaign.view`

Response:

- normalized model described above

### Service Dependencies

The service can reuse:

- `CampaignService`
- `CampaignStudioScheduleService`
- readiness/milestone rules where practical
- Sponsor and Sponsorship models
- SponsorInteraction model
- gift workflow models as needed

### Performance

The endpoint should avoid one query per item.

Use grouped queries for:

- sponsor drop-off counts by date/status
- sponsor follow-up counts by date
- gift status counts

V1 can cap detailed names to the first 5 per grouped item.

## Frontend Design

### API Client

The frontend calendar intelligence API is implemented in the existing Campaign Studio API client:

- `blessing-tree-ui/src/features/campaigns/api/campaignStudioApi.ts`

Model:

- `CampaignCalendarIntelligence`
- `CampaignCalendarIntelligenceItem`
- `CampaignCriticalDate`
- `CampaignAgendaGroup`

### Data Loading

`CampaignStudioScheduleSection` fetches calendar intelligence directly and reloads when:

- schedule events change
- milestones change
- communication schedules change

Campaign settings date refresh can be added when the settings panel mutates dates from the same Studio session.

### Components

Implemented inside:

- `CampaignCalendarOverviewPanel`
- `CalendarMetric`
- `CampaignCalendarAgendaList`

Placement:

- inside `CampaignStudioScheduleSection`
- above `CampaignStudioScheduleCalendar`

### UI Behavior

Click behavior:

- milestone/manual/communication items open the existing schedule modal where possible
- missing milestone dates open the milestone editor with the milestone preselected
- grouped sponsor drop-off and follow-up items currently show in the overview and Ask; deeper report-filter routing can be added later

### Visual Style

Use compact, operational UI:

- small status badges
- icons by item type
- clear date labels
- high contrast for blockers/overdue
- no large hero panels

## Data Freshness

V1 can refresh on page load and after local schedule mutations.

Later enhancement:

- poll every 30-60 seconds while Schedule is open
- or share the existing gift status polling pattern if appropriate

## Permissions

Read:

- users with campaign view permissions can see the overview

Write:

- only campaign managers/admins can edit underlying items

Ask:

- Ask should only return calendar information the user is allowed to view
- actions should respect existing RBAC action filtering

## Implementation Plan

### Phase 1: Backend Calendar Intelligence

Status: implemented.

Completed:

1. Added calendar intelligence service.
2. Built normalized item model.
3. Aggregated existing schedule items.
4. Added campaign setup dates.
5. Added milestone missing/blocker detection.
6. Added communication schedule summaries.
7. Added grouped sponsor drop-off due items.
8. Added grouped sponsor follow-up items.
9. Added API endpoint.
10. Added backend tests for grouping, missing dates, overdue dates, and RBAC.

### Phase 2: Campaign Studio Overview UI

Status: implemented.

Completed:

1. Added frontend API models and fetcher.
2. Added critical date strip.
3. Added agenda panel.
4. Wired click actions to existing modal routes.
5. Added direct missing-milestone edit flow.
6. Refreshes intelligence after schedule inputs change.
7. Added responsive styling.
8. Added frontend tests for create/edit/read-only and missing milestone behavior.

### Phase 3: Ask Blessing Tree Calendar Queries

Status: implemented.

Completed:

1. Added calendar questions to Ask report catalog/classifier.
2. Added executor methods backed by calendar intelligence service.
3. Supported common natural language date questions.
4. Added report-style answers with counts, dates, and actions.
5. Added tests for:
   - missing blocker questions
   - scheduled communication questions
   - specific date questions
   - sponsor follow-up questions
   - outside campaign window questions

### Phase 4: Polish And Extensions

Status: partially implemented.

Completed:

1. Added "date outside campaign window" warnings.
2. Added Dashboard widget reuse.
3. Added warning strip in Campaign Studio Schedule.

Remaining optional extensions:

1. Add calendar filters if users ask for them.
2. Add optional polling while Schedule is open.
3. Add PDF/export if this becomes a formal report.
4. Add route-filtered deep links for sponsor drop-off and follow-up grouped rows.

## Testing Strategy

### Backend

Test:

- critical date generation
- missing blocker date generation
- overdue classification
- due soon classification
- grouped sponsor drop-off items
- grouped follow-up items
- communication schedule inclusion
- RBAC protection
- Ask calendar question routing

### Frontend

Test:

- critical date strip renders missing and populated dates
- agenda groups render correctly
- click actions call expected handlers/routes
- read-only users can view but not edit
- empty-state campaign is understandable

### Manual QA

Use a seeded campaign with:

- missing sponsor recruitment date
- gift turn-in milestone in the past
- scheduled communication
- manual wrapping event
- sponsor drop-off due dates
- sponsor follow-ups due

Verify:

- overview shows the right counts
- critical dates show missing/overdue/upcoming
- dashboard Upcoming Calendar matches upcoming overview facts
- large calendar still works
- Ask answers the same facts as the overview

## Non-Goals For V1

Do not implement yet:

- drag-and-drop date changes
- recurring events
- external calendar sync
- ICS export/import
- per-user personal calendars
- automatic rescheduling
- LLM-generated calendar edits without user approval
- persistent calendar intelligence table

## Open Questions

Recommended defaults:

1. Should sponsor drop-off due dates appear individually or grouped?
   - Recommendation: grouped by default, individual details only when count is small.

2. Should missing optional milestones appear in the overview?
   - Recommendation: show only missing blocker/critical dates in the default view; optional missing dates can appear in a lower-priority section later.

3. Should Ask answer date questions from raw data or from the same overview service?
   - Decision: use the same overview service.

4. Should the overview include completed past items?
   - Recommendation: hide completed past items by default, but include them in Ask when explicitly requested.

5. Should this live under Schedule or as its own Campaign Studio section?
   - Decision: keep it under Schedule so all date work stays together.

## Recommendation

Implement the shared backend calendar intelligence service first, then add the visual overview, then connect Ask Blessing Tree to the same service.

That sequence prevents the UI and chatbot from giving different answers and keeps the app maintainable as more date-driven workflows are added.
