# Admin Activity Log Design

Last updated: 2026-05-29

## Status

Phase 1 foundation implemented on 2026-05-29:

- durable `audit_event` table migration
- SQLAlchemy model
- `AuditEventService`
- app-admin list/detail API
- backend API/service tests

Phase 2 Admin UI implemented on 2026-05-29:

- Admin > Activity Log navigation
- filterable, paginated activity table
- row-click detail drawer with before/after changes
- frontend API types, client helpers, and tests

Phase 3 initial admin event writers implemented on 2026-05-29:

- user invitations, role changes, activation/deactivation, deletion
- user campaign access changes
- invitation resend
- LLM configuration changes
- feature flag activation/deactivation
- organization type create/update/delete/deactivate
- campaign milestone definition create/update
- readiness rule create/update
- Ask Blessing Tree review actions

Phase 4 initial campaign workflow event writers implemented on 2026-05-29:

- recipient group create/update/delete
- group contact create/update/delete
- recipient create/update/delete
- wishlist create/update
- wishlist gift create/update/delete
- sponsor create/update/delete
- sponsor interaction create/update/delete
- gift commit/release and operational status changes

Phase 5 campaign studio/template event writers implemented on 2026-05-29:

- communication template create/update/delete
- communication test send and campaign send
- communication schedule create/update/delete
- flyer create/update/delete
- manual calendar event create/update/delete
- milestone replacement
- gift policy update
- gift tag template update

Phase 6 final campaign workflow event writers implemented on 2026-05-29:

- campaign create/update/settings changes
- campaign team members, access roles, teams, roles, and memberships
- app access link/invite/removal from campaign team members
- gift tag print jobs
- donation pool donations and donation lines
- gift pool line updates and assignments
- staff and public QR scan actions

The MVP audit coverage is complete. Future additions should be incremental
writers for newly introduced workflows, plus optional export/retention policies
if users ask for them.

This document describes a durable, user-friendly audit/activity log for the
Admin section. The current backend captures request-level audit metadata into
Valkey, but that data is operational and technical. The new feature should show
staff what changed in plain language: who changed it, when it happened, what
area of the app it affected, and what values changed.

Related documents:

- `docs/engineering/security-tenancy.md`
- `docs/engineering/rbac-design.md`
- `docs/engineering/campaign-recipient-design.md`
- `docs/engineering/gift-workflow-design.md`
- `docs/engineering/sponsor-communication-send-design.md`

## Problem

Production users will need to answer questions like:

- Who changed this family?
- When was this sponsor updated?
- Who marked this gift as Distributed?
- What user deactivated this account?
- Who scheduled or sent this communication?
- What changed in the gift tag or flyer template?

The current Valkey request audit data can show that an authenticated request was
made to an endpoint, but it does not reliably produce a human-readable business
event. It is also not the right durable source for long-term history.

## Goals

1. Add a durable MySQL-backed activity log.
2. Expose an Admin Activity Log screen.
3. Record high-value business events in plain language.
4. Preserve before/after field-level changes for updates.
5. Support filtering by date, user, campaign, app area, action, and search text.
6. Link activity rows back to the affected record where possible.
7. Keep the implementation incremental so major workflows can opt in over time.

## Non-Goals For MVP

- Full database-level change data capture.
- Reconstructing history for every old record.
- Showing every low-value field or internal-only update.
- Restoring records from audit history.
- User-managed audit retention policies.
- Exporting audit logs in the first pass.
- Diffing large rich-document payloads such as full flyer JSON or email HTML.

## Current State

### Request Audit

`app/factory.py` currently captures request metadata and writes it to Valkey:

- timestamp
- correlation id
- user id
- endpoint
- method
- IP address
- user agent
- masked request body
- status code
- response time

This should remain useful for operational troubleshooting, but it should not be
the primary Admin UI audit source.

### Domain Metadata

Many domain tables already have `created_at` and `updated_at`. Some tables have
`created_by_user_id`. That helps with "when" and sometimes "who created," but it
does not answer "what changed" or "who updated."

## Recommended Model

Create a new durable table:

`audit_event`

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `BINARY(16)` | UUID primary key. |
| `occurred_at` | `DATETIME` | UTC timestamp, indexed. |
| `actor_user_id` | `BINARY(16) NULL` | App user who performed the action when known. |
| `actor_display_name` | `VARCHAR(255) NULL` | Snapshot for display even if user later changes. |
| `actor_email` | `VARCHAR(255) NULL` | Snapshot for filtering/search. |
| `campaign_id` | `BINARY(16) NULL` | Campaign context when applicable. |
| `area` | `VARCHAR(64)` | Examples: `people`, `gifts`, `sponsors`, `campaigns`, `admin`, `communications`, `ask`, `templates`. |
| `action` | `VARCHAR(64)` | Examples: `created`, `updated`, `deleted`, `sent`, `scheduled`, `printed`, `scanned`, `status_changed`. |
| `entity_type` | `VARCHAR(96)` | Examples: `recipient_group`, `wishlist_item`, `sponsor`, `app_user`. |
| `entity_id` | `BINARY(16) NULL` | Affected row id when available. |
| `entity_label` | `VARCHAR(255) NULL` | Friendly snapshot such as `Johnson Household`. |
| `summary` | `VARCHAR(500)` | Plain-language row summary. |
| `change_set_json` | `JSON NULL` | Field-level before/after changes. |
| `metadata_json` | `JSON NULL` | Extra useful context. |
| `correlation_id` | `VARCHAR(64) NULL` | Request correlation id from Flask `g`. |
| `ip_address` | `VARCHAR(255) NULL` | Request IP or forwarded IP. |
| `user_agent` | `VARCHAR(500) NULL` | Request user agent, truncated. |
| `created_at` | `DATETIME` | Insert timestamp. |

Recommended indexes:

- `(occurred_at)`
- `(campaign_id, occurred_at)`
- `(actor_user_id, occurred_at)`
- `(area, occurred_at)`
- `(action, occurred_at)`
- `(entity_type, entity_id)`

## Change Set Shape

Store simple field changes as JSON:

```json
[
  {
    "field": "status",
    "label": "Status",
    "before": "Ready",
    "after": "Distributed"
  },
  {
    "field": "email",
    "label": "Email",
    "before": "old@example.com",
    "after": "new@example.com"
  }
]
```

Guidelines:

- Store friendly labels for display.
- Store normalized before/after values where possible.
- Redact secrets and sensitive tokens.
- Avoid logging full rich payloads.
- For large templates, log a summary such as "Body content changed" and store
  metadata like block count, not the full body.

## Event Taxonomy

Use a small controlled vocabulary so filters stay easy.

### Areas

| Area | Meaning |
| --- | --- |
| `admin` | User management, feature flags, LLM config, organization types. |
| `campaigns` | Campaign record, campaign settings, milestones, rules, calendar. |
| `people` | Families, organizations, contacts, children/adults, wishlists. |
| `sponsors` | Sponsor records, sponsorships, interactions. |
| `gifts` | Gift status, reservations, donations/pool, labels, tags. |
| `communications` | Templates, sends, schedules, reminders. |
| `reports` | Exports and report access when needed. |
| `ask` | Ask Blessing Tree prompts, feedback, knowledge administration. |

### Actions

| Action | Meaning |
| --- | --- |
| `created` | New record created. |
| `updated` | Existing record changed. |
| `deleted` | Record deleted. |
| `status_changed` | Operational status transition. |
| `sent` | Email or communication sent. |
| `scheduled` | Future communication/event scheduled. |
| `printed` | Gift tag/flyer/label printed or print job created. |
| `scanned` | QR code scan action completed. |
| `activated` | User/campaign/rule/template activated. |
| `deactivated` | User/campaign/rule/template deactivated. |

## Backend Design

### Model

Add `app/models/audit_event.py` and include it in `app/models/models.py`.

Recommended SQLAlchemy relationships:

- optional `actor_user` relationship to `AppUser`
- optional `campaign` relationship to `Campaign`

Do not cascade delete audit events when a user, campaign, or entity is deleted.
The snapshot fields preserve display context.

### Migration

Add a migration after the current latest migration:

`V0XX__Audit_Event_Log.sql`

The migration should create the table and indexes only. It should not attempt to
backfill historical events.

### Audit Service

Add:

`app/features/admin/audit_service.py`

Primary API:

```python
class AuditEventService:
    def record_event(
        self,
        db: Session,
        *,
        area: str,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID | None = None,
        entity_label: str | None = None,
        campaign_id: uuid.UUID | None = None,
        actor_user_id: uuid.UUID | None = None,
        summary: str,
        changes: list[AuditChange] | None = None,
        metadata: dict[str, object] | None = None,
    ) -> AuditEvent:
        ...
```

Helpers:

- `build_changes(before, after, field_map)` for service-level update diffs.
- `current_request_context()` to read `g.correlation_id`, IP, and user agent.
- `resolve_actor_snapshot(db, user_id)` to store actor name/email.

Implementation rules:

- Audit logging should not block the primary operation unless the database is
  unavailable for the primary transaction anyway.
- In normal service methods, write the audit event in the same transaction as
  the business change.
- For background jobs, actor may be null and metadata should include
  `system_actor: "celery"` or the initiating schedule/send id.
- Do not log passwords, reset tokens, invite tokens, SMTP credentials, API keys,
  raw LLM keys, or refresh/access tokens.

### Admin API

Add routes under `/api/v1/admin/audit-events`.

`GET /api/v1/admin/audit-events`

Query parameters:

- `page`
- `page_size`
- `date_from`
- `date_to`
- `actor_user_id`
- `campaign_id`
- `area`
- `action`
- `entity_type`
- `search`

Response:

```json
{
  "items": [
    {
      "id": "...",
      "occurred_at": "...",
      "actor": {
        "user_id": "...",
        "display_name": "Jane Smith",
        "email": "jane@example.com"
      },
      "campaign": {
        "id": "...",
        "name": "Blessing Tree 2026"
      },
      "area": "gifts",
      "action": "status_changed",
      "entity_type": "wishlist_item",
      "entity_id": "...",
      "entity_label": "Art kit",
      "summary": "Jane changed Art kit from Ready to Distributed.",
      "change_count": 1
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 143
  },
  "filters": {
    "areas": ["admin", "campaigns", "people", "sponsors", "gifts", "communications"],
    "actions": ["created", "updated", "deleted", "status_changed", "sent", "scheduled"]
  }
}
```

`GET /api/v1/admin/audit-events/<event_id>`

Returns the full event, including `change_set` and `metadata`.

Authorization:

- MVP: require app admin.
- Later: allow campaign managers to see campaign-scoped activity for campaigns
  where they have `campaign.admin`.

## Frontend Design

### Navigation

Add an Admin child link:

`Admin > Activity Log`

Use a plain operational icon such as `bi-clock-history`.

### Page

Create:

`blessing-tree-ui/src/pages/AdminActivityLogPage.tsx`

The screen should match the existing admin table/drawer pattern:

- top filter strip
- table of activity events
- row click opens drawer
- drawer shows the details

### Table Columns

Recommended columns:

- When
- User
- Area
- Action
- Campaign
- What Changed

Default sort:

- newest first

### Filters

MVP filters:

- search
- date range
- campaign
- user
- area
- action

Keep filters simple and compact. These users should not need to understand the
technical `entity_type`.

### Drawer

Drawer sections:

1. Summary
   - summary
   - actor
   - occurred at
   - campaign
2. Changes
   - field label
   - before
   - after
3. Technical Details
   - collapsed by default
   - correlation id
   - IP address
   - entity type/id
   - metadata JSON

### Empty State

Use plain copy:

"No activity matches these filters."

Avoid technical explanations in the UI.

## MVP Event Coverage

Start with high-value areas where support questions are most likely.

### Phase 1: Admin And Campaign Setup

- user invited
- user created
- user activated/deactivated/deleted
- user access changed
- campaign created/updated
- milestone/rule created/updated/deleted
- organization type created/updated/deleted

### Phase 2: People And Sponsors

- family created/updated/deleted
- organization created/updated/deleted
- contact created/updated/deleted
- recipient created/updated/deleted
- wishlist item created/updated/deleted
- sponsor created/updated/deleted
- sponsorship created/updated/deleted
- sponsor interaction created/updated/deleted

### Phase 3: Gifts And Communications

- gift status changed
- gift reserved/committed/released
- gift received/wrapped/ready/picked up/distributed
- manual gift label created/printed
- gift tag template created/updated/deleted
- flyer created/updated/deleted
- communication template created/updated/deleted
- communication sent
- communication scheduled/updated/cancelled
- reminder rule created/updated/deleted

### Phase 4: Ask And Reporting

- Ask prompt feedback accepted/rejected
- knowledge base document regenerated
- report exported
- admin LLM configuration changed, without exposing secrets

## How To Record Events Without Making Services Messy

Recommended pattern:

1. Keep audit event creation in `AuditEventService`.
2. Add small local calls at the end of existing service methods.
3. Keep field maps close to each service because the service knows the friendly
   domain labels.
4. Use common helpers for repetitive model diffs.

Example:

```python
changes = build_changes(
    before=before_snapshot,
    after=recipient,
    field_map={
        "age": "Age",
        "gender": "Gender",
        "status": "Status",
        "notes": "Notes",
    },
)
audit_service.record_event(
    db,
    area="people",
    action="updated",
    entity_type="recipient",
    entity_id=recipient.id,
    entity_label=recipient.display_label,
    campaign_id=recipient.campaign_id,
    actor_user_id=current_user_id,
    summary=f"{actor_name} updated {recipient.display_label}.",
    changes=changes,
)
```

Do not implement this with SQLAlchemy global event listeners for MVP. Global
listeners are tempting but tend to produce technical diffs that are hard to
translate into user-friendly summaries. Service-level calls are more explicit
and easier to control.

## Data Retention

MVP recommendation:

- Keep audit events indefinitely during early production.
- Add database indexes from day one.
- Revisit retention after real usage volume is known.

Future options:

- keep 24 months online
- archive older activity to compressed object storage
- keep security/admin events longer than routine view/export events

## Privacy And Security

Never record:

- passwords
- password reset tokens
- invite tokens
- refresh/access tokens
- OAuth secrets
- SMTP passwords
- LLM/API keys
- full email bodies if they may contain sensitive data

Be careful with child information:

- Use public-safe labels where possible.
- Avoid logging private child names if the workflow intentionally avoids them.
- For wishlist gifts, log the item label/description only if it is already
  visible to authorized staff.

## Testing Plan

Backend tests:

- migration creates table and indexes
- `AuditEventService.record_event` stores actor snapshot and request context
- list endpoint filters by area/action/user/campaign/search/date
- detail endpoint returns change set
- admin authorization required
- sensitive fields are redacted by helper tests

Frontend tests:

- Activity Log appears for app admins
- list renders events and filters
- row click opens drawer
- drawer renders before/after changes
- empty state renders

Manual QA:

- create a campaign and confirm event
- update a family and confirm before/after values
- change a gift status and confirm status transition
- send a communication and confirm send event
- deactivate a user and confirm admin event

## Rollout Plan

### Step 1: Foundation

- Add migration and model.
- Add `AuditEventService`.
- Add admin list/detail API.
- Add tests.

### Step 2: Admin UI

- Add Admin Activity Log route and nav link.
- Add table, filters, pagination, and drawer.
- Add frontend tests.

### Step 3: First Event Writers

- User management.
- Campaign create/update.
- Organization type create/update/delete.
- Gift status changes.
- Communication send/schedule.

### Step 4: Broader Event Writers

- People workspace.
- Sponsor workspace.
- Gift tag/flyer builders.
- Reminder rules.
- Ask feedback/admin review.

### Step 5: Production Hardening

- Add retention policy decision.
- Add export if users request it.
- Add campaign-manager scoped visibility if needed.
- Add quick links from activity event to entity screen when route context is
  available.

## Open Questions

1. Should campaign managers see only their campaign activity, or should the MVP
   stay app-admin only?
2. How long should audit records be retained once the app is in broad
   production?
3. Should report exports be logged in MVP, or only after reports contain more
   sensitive operational data?
4. Should public QR scan actions be shown in Admin Activity Log, Gift Status
   history, or both?
5. Should the Activity Log eventually support Excel/PDF export like reports?

## Recommendation

Implement the foundation, API, and Admin UI first, then add event writers to the
highest-value workflows. This gives users immediate visibility into important
admin and campaign changes without delaying the whole feature until every table
is instrumented.
