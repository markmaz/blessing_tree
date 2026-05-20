# AI Agent Rules

## Session Start Rule

Before doing substantive work, read:

1. `memory.md`
2. `docs/engineering/ai-agent-rules.md`
3. `memory/current-state.md`
4. `memory/active-workstreams.md`
5. Any additional durable guidance relevant to the task

## Working Rules

- Maintain project continuity by updating the appropriate file in `memory/` when decisions, priorities, or notable discoveries change.
- Keep `memory.md` as the entrypoint only. Do not turn it back into a large running log.
- Ignore `files/` completely for active project work unless the user explicitly reintroduces it.
- Prefer updating canonical docs instead of allowing duplicate or stale summaries to accumulate.
- When work changes project policy, move that rule into `docs/engineering/` and leave only operational context in `memory/`.

## Current Canonical Docs

- `README.md`
- `ROADMAP.md`
- `blessing-tree-api/README.md`
- `blessing-tree-ui/README.md`

## Current Project-Specific Caution

- The frontend now completes local login, OAuth callback handoff, and reload-time session restoration against the real backend auth routes. The remaining auth hardening gap is active-session token refresh once more API traffic exists.
