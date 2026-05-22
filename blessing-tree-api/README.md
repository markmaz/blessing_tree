# Blessing Tree API

## Overview

The backend is a Flask application built around:

- Flask app factory in `app/factory.py`
- auth namespace in `app/routes/auth_routes.py`
- SQLAlchemy models in `app/models/`
- MySQL migrations in `db/migration/`
- Celery integration in `app/celery.py`
- Valkey-backed audit logging in `app/factory.py`

## Current Status

- Authentication routes are implemented.
- The broader domain model exists in SQLAlchemy and SQL migration form.
- The initial RBAC foundation now exists as a feature package with campaign role persistence, a capability matrix, an authorization service, and reusable enforcement decorators.
- The first campaign business routes now exist as a feature package with protected list, detail, access, summary, create, and update endpoints.
- Campaign Studio backend support now exists for team assignments, campaign-scoped communication templates/schedules, milestone dates, readiness evaluation, aggregate studio payloads, manual campaign events, unified schedule reads, and clone-from-previous campaign creation support.
- Recipient phase 1 backend refinement now exists, including refined recipient-group, contact, recipient, wishlist, and wishlist-item schema/model support for both household children and nursing-home adults.
- Campaign automation runtime now exists for scheduled communication dispatch, lifecycle transitions, execution logging, worker heartbeat, and readiness health checks.
- Local development mail delivery can now run through a checked-in SMTP sink script so invite emails and scheduled communications can be exercised end to end without external SMTP credentials.
- Admin runtime support now exists for Query Forge-style user invitations, global LLM configuration, runtime health probes, and app feature flags.
- Campaign Studio now also exposes a campaign-scoped active-user directory search endpoint to support assignment creation from the frontend.
- The Team redesign backend now also exposes member, access-role, team, membership, and aggregate Team workspace APIs alongside the older transitional assignment endpoints.
- Dependency manifests now exist as `requirements.txt` and `requirements-dev.txt`.
- Backend build version now lives in `version.json`.

## Entry Point

```bash
python app/main.py
```

App creation happens in `app/factory.py`.

## Installation

Create and activate a virtual environment, then install dependencies.

Runtime only:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Development:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
```

## Environment Bootstrap

Start from the checked-in example file:

```bash
cp .env.example .env
```

Minimum local values to set before the API will boot cleanly:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `VALKEY_ADDRESS`, `VALKEY_PORT`
- `FRONTEND_BASE_URL`

Optional local auth providers:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI`

Optional local mail transport tuning:

- `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
- `SMTP_USE_TLS`, `SMTP_USE_SSL`
- `DEFAULT_MAIL_SENDER`

The `.env.example` contract now follows the same broad setup conventions as Query Forge for:

- database and pool settings
- JWT and refresh-cookie settings
- Valkey connection settings
- frontend URL and mail-related links

## Auth Routes

Current routes under `/api/v1/auth`:

- `POST /local/login`
- `GET /google/login`
- `GET /invite/google/login`
- `GET /google/callback`
- `GET /yahoo/login`
- `GET /invite/yahoo/login`
- `GET /yahoo/callback`
- `POST /refresh`
- `POST /logout`
- `GET /invite/validate/<token>`
- `POST /invite/accept`

Important current behavior:

- local login returns an access token payload
- refresh token handling is cookie-based
- OAuth callbacks issue the refresh cookie and then redirect to the frontend callback route for session completion
- generic Google/Yahoo login is now for already-linked returning users only
- invite-based onboarding now supports Google, Yahoo, or local-password acceptance from the invitation funnel
- invite validation now returns onboarding/completion state so the frontend can distinguish a pending invite from an already-accepted account
- generic Google/Yahoo returning-login verification is implemented, but a true live provider smoke test still depends on local provider credentials being configured

## Data Model

The current schema covers:

- users and auth identities
- campaigns
- recipient groups and recipients
- wishlists and wishlist items
- sponsors and sponsorships
- donations and fulfillment
- pickup tracking
- label printing
- scan and audit events

Core model files live in `app/models/`.
RBAC feature code lives in `app/features/rbac/`, including:

- `constants.py`
- `services/authorization_service.py`
- `decorators.py`
- `scope.py`
Core DDL lives in:

- `db/migration/V001__Initial_DB.sql`
- `db/migration/V002__Auth_Identity.sql`
- `db/migration/V003__Campaign_User_Roles.sql`
- `db/migration/V004__Campaign_Metadata.sql`
- `db/migration/V005__Campaign_Studio_Support.sql`
- `db/migration/V006__Campaign_Schedule.sql`
- `db/migration/V007__Campaign_Members.sql`
- `db/migration/V008__Campaign_Member_Access_Roles.sql`
- `db/migration/V009__Campaign_Teams.sql`
- `db/migration/V010__Campaign_Team_Roles.sql`
- `db/migration/V011__Campaign_Automation_Runtime.sql`
- `db/migration/V012__Admin_Runtime.sql`
- `db/migration/V013__Campaign_Scoped_Communication_Templates.sql`
- `db/migration/V014__Recipient_Refinement.sql`

## Campaign Routes

Current routes under `/api/v1/campaigns`:

- `GET /`
- `POST /`
- `GET /<campaign_id>`
- `PATCH /<campaign_id>`
- `GET /<campaign_id>/access`
- `GET /<campaign_id>/summary`
- `GET /<campaign_id>/studio`
- `GET /<campaign_id>/assignments`
- `POST /<campaign_id>/assignments`
- `GET /<campaign_id>/directory-users`
- `PATCH /<campaign_id>/assignments/<assignment_id>`
- `GET /<campaign_id>/communications/templates`
- `POST /<campaign_id>/communications/templates`
- `PATCH /<campaign_id>/communications/templates/<template_id>`
- `DELETE /<campaign_id>/communications/templates/<template_id>`
- `GET /<campaign_id>/team-workspace`
- `GET /<campaign_id>/members`
- `POST /<campaign_id>/members`
- `GET /<campaign_id>/members/<member_id>`
- `PATCH /<campaign_id>/members/<member_id>`
- `GET /<campaign_id>/member-access-roles`
- `POST /<campaign_id>/members/<member_id>/access-roles`
- `PATCH /<campaign_id>/members/<member_id>/access-roles/<assignment_id>`
- `GET /<campaign_id>/teams`
- `POST /<campaign_id>/teams`
- `PATCH /<campaign_id>/teams/<team_id>`
- `POST /<campaign_id>/teams/<team_id>/members`
- `DELETE /<campaign_id>/teams/<team_id>/members/<member_id>`
- `POST /<campaign_id>/members/<member_id>/link-app-user`
- `POST /<campaign_id>/members/<member_id>/invite-app-access`
- `DELETE /<campaign_id>/members/<member_id>/app-access`
- `GET /<campaign_id>/communications/schedules`
- `POST /<campaign_id>/communications/schedules`
- `PATCH /<campaign_id>/communications/schedules/<schedule_id>`
- `GET /<campaign_id>/schedule`
- `GET /<campaign_id>/events`
- `POST /<campaign_id>/events`
- `PATCH /<campaign_id>/events/<event_id>`
- `DELETE /<campaign_id>/events/<event_id>`
- `GET /<campaign_id>/milestones`
- `PUT /<campaign_id>/milestones`
- `GET /<campaign_id>/readiness`
- `POST /<campaign_id>/ai/draft`

Current behavior:

- list is filtered to campaigns visible to the current user
- create is app-admin only
- create can optionally clone setup from an earlier campaign through `source_campaign_id`
- detail, access, and summary require campaign visibility via RBAC
- update requires the `campaign.admin` capability
- directory-user search requires the `campaign.admin` capability and returns active users plus current/inactive role context for that campaign
- Team workspace APIs now expose the member-centric roster, access-role, and team model that will replace the older assignment-first Team Studio flow
- unified schedule reads require `campaign.view`
- manual schedule event CRUD requires `campaign.admin`
- campaign metadata now includes `description`
- multiple campaigns per year are allowed
- Campaign Studio aggregate and section endpoints now power team, communications, milestone, and readiness cards in the frontend studio shell
- schedule APIs now unify manual events with milestone-derived and communication-derived items for the upcoming Studio `Schedule` section
- AI draft actions now cover schedule, communications, team, readiness, and settings planning flows through a campaign-scoped draft/apply contract
- Campaign Studio AI now attempts structured drafts through the configured admin LLM first and falls back to the deterministic draft engine when the LLM is missing, disabled, unavailable, or returns an invalid action payload

## Admin Routes

Current routes under `/api/v1/admin`:

- `GET /users`
- `POST /users`
- `PATCH /users/<user_id>/status`
- `POST /invitations/<invitation_id>/resend`
- `GET /llm`
- `PUT /llm`
- `POST /llm/test`
- `GET /health`
- `GET /features`
- `PUT /features/<feature_key>`

Current behavior:

- most admin routes require the app-admin capability
- `GET /features` is readable by authenticated users so the frontend can gate nav/routes consistently
- invitations create local app users and deliver signed invite-accept URLs through the mailer/task path
- app admins can activate or deactivate users without deleting the account record
- LLM settings are stored globally with the API key encrypted at rest
- health reports cover database connectivity, Celery worker state/heartbeat, and the configured LLM endpoint
- the same configured LLM is now the primary draft engine for Campaign Studio AI, while the older deterministic draft logic remains in place as fallback and verification guardrails
- admin LLM test/health now validates the real generation path against the configured model instead of only checking `/models`, so model-access problems surface before users hit the Campaign Studio AI drawer
- the Admin LLM UI can now populate its model combo/input suggestions from the configured provider's `/models` response through `GET /api/v1/admin/llm/models`, and that endpoint now surfaces provider-catalog failures so the UI can explain when it is falling back to presets

## Local Commands

From `blessing-tree-api/`:

```bash
scripts/test.sh
scripts/lint.sh
scripts/coverage.sh
./.venv/bin/python -m celery -A app.celery worker --loglevel=INFO
./.venv/bin/python -m celery -A app.celery beat --loglevel=INFO --schedule=/tmp/blessing-tree-celerybeat-schedule
./.venv/bin/python scripts/dev_smtp_sink.py
```

## Environment Notes

Environment variables are loaded from `app/config/__init__.py` via `python-dotenv`.

Current configuration expects values for at least:

- database connection: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- JWT/auth: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- refresh cookie/auth options
- Valkey: `VALKEY_ADDRESS`, `VALKEY_PORT`, `LOG_QUEUE`
- OAuth providers as needed
- mail transport: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USE_TLS`, `SMTP_USE_SSL`, `DEFAULT_MAIL_SENDER`

For local development without a real SMTP relay, start the sink and point `.env` at it:

```bash
./.venv/bin/python scripts/dev_smtp_sink.py
```

Then use:

- `SMTP_SERVER=127.0.0.1`
- `SMTP_PORT=1025`
- `SMTP_USE_TLS=false`
- `SMTP_USE_SSL=false`

Captured messages are written under `tmp/dev-mail/`.
- mail settings as needed

Config cleanup notes:

- `SMTP_PORT` is the canonical mail port variable; the app still accepts legacy `SMPT_PORT` for compatibility.
- `VALKEY_ADDRESS` is the canonical cache/broker host variable; `VALKEY_HOST` is also accepted for compatibility.
- Celery now uses a dedicated default queue named `bt`, even when sharing the same local Valkey broker with other projects.
- Scheduled communication delivery requires working SMTP settings; otherwise the worker will still execute schedules, but it will log failed delivery attempts instead of sending mail.
- Admin LLM health checks can probe an OpenAI-compatible `/models` endpoint when an API key and base URL are configured.

## Versioning

- Backend build version is stored in `version.json`.
- API route versioning remains in `app/factory.py` as `v1` path construction and should not be used as the backend build version.
