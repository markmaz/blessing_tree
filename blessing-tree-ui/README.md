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
- The Team section can now search the active user directory and create campaign role assignments directly from Studio.
- The communications section is now a template-only builder with a collapsible saved-template rail, metadata/content editing, rendered preview, heading/text/image content blocks, and inline uploads for small embedded images; communication timing remains in the calendar/scheduler flow.
- The dates section now saves campaign milestone dates through the studio.
- A Vitest + Testing Library harness now exists for automated frontend tests.
- App admins can now create campaigns from the campaign library UI.
- Campaign managers and app admins can now update campaign metadata, dates, and status from the detail page and Studio settings section.
- Several older UI docs were delivery-era summaries and have been consolidated.

## Routes

Public routes:

- `/login`
- `/auth/callback`

Protected routes:

- `/`
- `/campaigns`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/studio`
- `/families`
- `/donations`
- `/reports`
- `/admin`

Route constants live in `src/app/routes.ts`.

## Important Files

- `src/app/App.tsx`: router and protected shell wiring
- `src/shared/ui/layout/AppLayout.tsx`: sidebar/topbar app shell
- `src/features/auth/model/authContext.tsx`: client auth state
- `src/shared/api/authApi.ts`: frontend auth API client
- `src/shared/api/client.ts`: shared authenticated fetch layer with refresh-on-401 handling
- `src/features/campaigns/`: campaign API client, state, and UI components
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
