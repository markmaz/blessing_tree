# Blessing Tree UI

## Overview

The frontend is a React 19 + TypeScript + Vite application with:

- authenticated routing
- a protected app shell
- pages for dashboard, families, donations, reports, and admin
- Bootstrap-based styling
- a direct local-login flow bridged to the Flask backend auth routes

## Current Status

- `src/app/App.tsx` uses nested protected routes with `AppLayout`.
- `src/shared/api/authApi.ts` already calls the backend local login route.
- The frontend now completes local login directly on `/login` and includes backend refresh-cookie handling.
- The frontend now consumes the protected campaign APIs through a campaign provider, top-bar switcher, campaign list, campaign detail page, and a campaign-aware dashboard.
- Campaign Studio now has real Team, Communications, Schedule, Readiness, and Settings sections backed by the new backend studio APIs.
- The Schedule surface is now calendar-first, with a navigable month view, color-coded milestones/communications/events, and modal editing directly from the calendar grid.
- The Studio AI rail can now draft and apply new schedule events, milestones, and communication schedules from prompt input, and the readiness surface still includes schedule-specific warnings from the backend.
- Success alerts in Studio and campaign management flows now fade and dismiss themselves automatically after a short interval.
- The Team section is now a member-centric workspace with a roster table, filters, team management, and Query Forge-style edit drawers for people, access roles, app access, and operational teams.
- The Team workspace now separates responsibilities more clearly: person drawers focus on profile and app access, while team drawers own team setup and membership changes.
- The Team workspace now uses two first-class tables instead of a side rail: a People table for roster/access management and a Teams table for operational group management.
- The Team workspace is now intentionally reduced to search-plus-sort controls: compact top stats, a People card with search and sortable columns, and a Teams card with the same simpler interaction model.
- The Team section now also includes inline concept help for roster terms such as `Member Type`, `App Access`, `App Access Roles`, and `Teams`, and the Studio AI drawer now exposes the same Team glossary when the Team section is active.
- The Team workspace now consumes the backend-provided app access role catalog, so role labels and descriptions are no longer duplicated in the frontend.
- The Admin area now uses child pages under `/admin` for user management, LLM configuration, and health checks, while keeping app feature toggles alongside the LLM configuration workspace.
- The communications section is now a template-only builder with a collapsible tool rail, metadata/content editing, a stronger rendered preview surface, a builder-side merge-field drawer, heading/text/image content blocks, and inline uploads for small embedded images; the Studio AI panel now opens as a hidden right drawer instead of taking permanent page width.
- The dates section now saves campaign milestone dates through the studio.
- A Vitest + Testing Library harness now exists for automated frontend tests.
- The protected app shell footer now shows `QueryForge, LLC` copyright plus frontend and backend version numbers.
- App admins can now create campaigns from the campaign library UI.
- Campaign managers and app admins can now update campaign metadata, dates, and status from the detail page and Studio settings section.
- Several older UI docs were delivery-era summaries and have been consolidated.

## Routes

Public routes:

- `/login`
- `/auth/callback`
- `/auth/register`

Protected routes:

- `/`
- `/campaigns`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/studio`
- `/families`
- `/donations`
- `/reports`
- `/admin`
- `/admin/users`
- `/admin/llm`
- `/admin/health`

Route constants live in `src/app/routes.ts`.

## Important Files

- `src/app/App.tsx`: router and protected shell wiring
- `src/shared/ui/layout/AppLayout.tsx`: sidebar/topbar app shell
- `src/features/auth/model/authContext.tsx`: client auth state
- `src/shared/api/authApi.ts`: frontend auth API client
- `src/shared/api/client.ts`: shared authenticated fetch layer with refresh-on-401 handling
- `src/features/campaigns/`: campaign API client, state, and UI components
- `src/features/admin/`: admin API client, feature-flag context, and admin workspace cards
- `src/pages/CampaignStudioPage.tsx`: Campaign Studio workspace and section routing
- `src/features/campaigns/api/campaignStudioApi.ts`: studio aggregate and mutation API client
- `src/features/campaigns/model/useCampaignStudio.ts`: studio state and reload/mutation flow
- `src/features/campaigns/ui/CampaignEditorForm.tsx`: reusable create/update campaign editor
- `src/pages/`: current page-level UI

## Local Commands

From `blessing-tree-ui/`:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run preview
```

## Environment

Current frontend API configuration:

- `VITE_API_BASE_URL`

If unset, the frontend defaults to:

```text
http://localhost:5000
```

## Auth Flow Today

Current sequence:

1. user submits email/password on `/login`
2. frontend calls `POST /api/v1/auth/local/login`
3. backend returns an access token and sets the refresh cookie
4. frontend stores the access token and enters the protected app
5. on reload without a stored token, the frontend attempts `POST /api/v1/auth/refresh` to restore the session from the refresh cookie

Invitation sequence:

1. app admin creates a user from `/admin`
2. backend creates an invitation and sends a signed accept link
3. invited user opens `/auth/register?token=...`
4. frontend validates the token and submits the password form
5. backend accepts the invite, links local auth, and marks the invitation accepted

OAuth sequence:

1. user starts provider login from `/login`
2. provider returns to the backend callback route
3. backend issues the refresh cookie and redirects to `/auth/callback`
4. frontend callback route calls `POST /api/v1/auth/refresh`
5. frontend stores the returned access token and enters the protected app

Active API calls should now be built on `src/shared/api/client.ts`, which retries once through `POST /api/v1/auth/refresh` after a 401 and keeps local auth storage synchronized.

## Documentation Notes

The following older files are retained only as redirects to the current docs:

- `PROJECT_SUMMARY.md`
- `SETUP.md`
- `COMMANDS.md`
- `INDEX.md`
- `FINAL_SUMMARY.txt`
