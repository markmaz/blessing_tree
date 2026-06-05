# Known Risks

Last updated: 2026-06-01

## Production Smoke After Dependency Changes

- Report exports now depend on `xlsx` in the frontend bundle.
- Risk: deployment will fail if `package-lock.json` and production build are
  not in sync, or if the Docker image is built from an older branch.
- Mitigation: `package-lock.json` was updated and local `npm run build` passed;
  smoke-test PDF and Excel export after deploy.

## Bundle Size

- The frontend build passes but still reports the known large Vite chunk
  warning.
- Risk: slower first load as the app grows, especially for non-technical users
  on older machines.
- Mitigation: later split heavy surfaces such as builders, Ask, report export
  libraries, and admin pages with route-level lazy loading.

## Ask Blessing Tree Expectations

- Ask now answers help, navigation, field-level, report, and calendar questions,
  with optional LLM/Qdrant enhancement.
- Risk: users may expect free-form data analysis beyond the validated report
  catalog.
- Mitigation: keep deterministic/report catalog paths authoritative, log failed
  prompts, and promote repeated misses into curated help/report handlers.

## Qdrant Optional Runtime

- Qdrant improves fuzzy help retrieval but should not be required for the app
  to function.
- Risk: enabling Qdrant without correct env/service setup can create confusing
  degraded behavior.
- Mitigation: deterministic Ask fallback must remain enabled; health/admin docs
  should make Qdrant status visible.

## Audit Log Scope

- Activity Log now records many high-value workflows, but it is still explicit
  service-level event writing rather than database-level change capture.
- Risk: newly added workflows may be missed unless developers remember to add
  audit writers.
- Mitigation: treat audit writer updates as part of definition of done for new
  mutating workflows.

## Report Export Scope

- Report and Activity Log exports use the currently loaded/filter-visible row
  set rather than silently exporting every possible row.
- Risk: users may expect "all matching rows" across pagination.
- Mitigation: documentation now explains export scope; future server-side export
  endpoints can be added if users need large exports.

## Production Monitoring

- Admin Health and local/cloud-ready logging exist, but the app does not yet
  have a polished admin-facing log viewer beyond Activity Log.
- Risk: technical runtime issues may still require SSH/log access.
- Mitigation: keep local logs structured and plan CloudWatch/log viewer work if
  operational support load increases.
