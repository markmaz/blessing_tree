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
- Campaign Studio backend support now exists for team assignments, communication templates/schedules, milestone dates, readiness evaluation, and aggregate studio payloads.
- Campaign Studio now also exposes a campaign-scoped active-user directory search endpoint to support assignment creation from the frontend.
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

The `.env.example` contract now follows the same broad setup conventions as Query Forge for:

- database and pool settings
- JWT and refresh-cookie settings
- Valkey connection settings
- frontend URL and mail-related links

## Auth Routes

Current routes under `/api/v1/auth`:

- `POST /local/login`
- `GET /google/login`
- `GET /google/callback`
- `GET /yahoo/login`
- `GET /yahoo/callback`
- `POST /refresh`
- `POST /logout`

Important current behavior:

- local login returns an access token payload
- refresh token handling is cookie-based
- OAuth callbacks issue the refresh cookie and then redirect to the frontend callback route for session completion

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
- `GET /<campaign_id>/communications/schedules`
- `POST /<campaign_id>/communications/schedules`
- `PATCH /<campaign_id>/communications/schedules/<schedule_id>`
- `GET /<campaign_id>/milestones`
- `PUT /<campaign_id>/milestones`
- `GET /<campaign_id>/readiness`

Current behavior:

- list is filtered to campaigns visible to the current user
- create is app-admin only
- detail, access, and summary require campaign visibility via RBAC
- update requires the `campaign.admin` capability
- directory-user search requires the `campaign.admin` capability and returns active users plus current/inactive role context for that campaign
- campaign metadata now includes `description`
- multiple campaigns per year are allowed
- Campaign Studio aggregate and section endpoints now power team, communications, milestone, and readiness cards in the frontend studio shell

## Local Commands

From `blessing-tree-api/`:

```bash
scripts/test.sh
scripts/lint.sh
scripts/coverage.sh
```

## Environment Notes

Environment variables are loaded from `app/config/__init__.py` via `python-dotenv`.

Current configuration expects values for at least:

- database connection: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- JWT/auth: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- refresh cookie/auth options
- Valkey: `VALKEY_ADDRESS`, `VALKEY_PORT`, `LOG_QUEUE`
- OAuth providers as needed
- mail settings as needed

Config cleanup notes:

- `SMTP_PORT` is the canonical mail port variable; the app still accepts legacy `SMPT_PORT` for compatibility.
- `VALKEY_ADDRESS` is the canonical cache/broker host variable; `VALKEY_HOST` is also accepted for compatibility.

## Versioning

- Backend build version is stored in `version.json`.
- API route versioning remains in `app/factory.py` as `v1` path construction and should not be used as the backend build version.
