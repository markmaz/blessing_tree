# Blessing Tree Engineering Memory Index

This file is the lightweight entrypoint for Blessing Tree engineering memory.
The older monolithic memory file has been split into durable engineering
guidance and short-lived operational memory.

At the start of a session, agents should read:

1. `docs/engineering/ai-agent-rules.md`
2. `memory/current-state.md`
3. `memory/active-workstreams.md`
4. Any relevant durable guidance below for the task being performed

## Durable Engineering System

- `docs/engineering/constitution.md` - non-negotiable project rules, invariants, and definition of done
- `docs/engineering/project-philosophy.md` - Blessing Tree engineering philosophy
- `docs/engineering/architecture.md` - current backend/frontend structure and system shape
- `docs/engineering/workflow.md` - how to approach phases, docs, and implementation sequencing
- `docs/engineering/coding-standards.md` - implementation standards for Flask, React, APIs, and docs
- `docs/engineering/refactor-guidelines.md` - refactor triggers and file-ownership guidance
- `docs/engineering/testing-strategy.md` - current verification expectations for backend and frontend
- `docs/engineering/security-tenancy.md` - auth, cookies, secrets, and trust-boundary guidance
- `docs/engineering/compatibility-versioning.md` - migration, env, API, and compatibility expectations

## Operational Memory

- `memory/current-state.md` - current project snapshot, runtime notes, and immediate facts
- `memory/active-workstreams.md` - active roadmap phase, recent progress, and next steps
- `memory/decisions.md` - project decisions with rationale and consequences
- `memory/known-risks.md` - current architectural, operational, and delivery risks
- `memory/fragile-areas.md` - code paths and contracts that need extra care

## Maintenance Rule

Keep durable guidance stable and low-noise. Put temporary coordination,
implementation progress, and task-specific notes in `memory/`. When a
short-term rule becomes project policy, promote it into `docs/engineering/`
and leave a concise pointer in the relevant memory file.
