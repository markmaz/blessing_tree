# Known Risks

Last updated: 2026-06-05

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

- Qdrant improves fuzzy Ask help retrieval and semantic Gift Search, but should
  not be required for the app to function.
- Risk: enabling Qdrant without correct env/service setup can create confusing
  degraded behavior, especially if production containers get
  `QDRANT_URL=http://localhost:6333`.
- Mitigation: deterministic Ask fallback must remain enabled; Admin Health
  makes Qdrant status/index generation visible; production Compose should use
  `QDRANT_URL=http://qdrant:6333`; Qdrant should remain internal-only and use
  `restart: unless-stopped`.

## Self-Hosted Runner Power

- The production EC2 host now runs a self-hosted GitHub Actions runner.
- Risk: any workflow scheduled to `[self-hosted, prod-blessing-tree]` executes
  shell commands on the production host with Docker access and limited sudo.
- Mitigation: keep the runner repo-scoped, use narrow labels, keep deploy jobs
  behind the GitHub `production` environment approval flow, never run untrusted
  pull request code on this runner, and keep sudoers limited to deploy/migration
  commands.

## Production Shared Env Ownership

- The production env file lives at `/opt/blessing-tree/shared/blessing-tree.env`.
- Risk: deploy scripts or workflow steps can accidentally change ownership or
  permissions on runtime secrets, making manual support harder or exposing
  values.
- Mitigation: `ec2_docker_deploy.sh` now only `chown`s the compose directory,
  not all of `/opt/blessing-tree`; future deployment edits should preserve the
  `shared` directory and create timestamped backups before env changes.

## Production Demo Seeding

- A production walkthrough campaign was appended to an existing production
  database.
- Risk: using the wrong seed mode could replace existing deterministic demo
  data or collide on labels/tokens/sponsor IDs.
- Mitigation: use `--append --campaign-name ... --campaign-slug ...` for
  production; append mode refuses duplicate name/slug/id; use unique campaign
  slugs for future demos.

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
