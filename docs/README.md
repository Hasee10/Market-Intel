# Docs

Everything that isn't code. Start at the repo [`README.md`](../README.md) if
you haven't.

Four docs deliberately stay at the **repo root** because they are consulted
constantly and referenced by name from code comments and migration headers:
`ROADMAP.md`, `FEATURES.md`, `SECURITY.md`, `SCRAPING.md`.

## Current

| File | What it answers | Read it when |
|---|---|---|
| [`memory.md`](memory.md) | *Why* the code is the way it is — a dated engineering log of decisions, failed approaches and the reasoning behind them | Before changing something that looks odd. The odd thing is usually load-bearing and the entry explains why |
| [`SELLER_TRACKED_COMPETITORS.md`](SELLER_TRACKED_COMPETITORS.md) | Scope for letting sellers nominate their own competitors | **Scoping only — nothing built** |
| [`ASSETS.md`](ASSETS.md) | Where brand/logo/hero source files live and which are authoritative | Touching anything visual |
| [`mind.md`](mind.md) | What is live vs. what needs migrations applied by hand | Wondering why a built feature does nothing in production |
| [`PROJECT_CONTEXT_PROMPT.md`](PROJECT_CONTEXT_PROMPT.md) | A pasteable project briefing | Onboarding a person or an agent |

## `architecture/`

| File | What it is |
|---|---|
| [`MIGRATION_PLAN.md`](architecture/MIGRATION_PLAN.md) | The Chakra → Tailwind UI migration: approach, order, current position. **In progress** — the app is a deliberate hybrid today |
| [`reports-v2-architecture.md`](architecture/reports-v2-architecture.md) | How PDF/PPTX report generation is structured |
| [`report-reference/`](architecture/report-reference/) | Reference material for report layout |

## `audits/`

Point-in-time reviews. Findings may be fixed — check dates and git history
before acting.

| File | What it is |
|---|---|
| [`leaks.md`](audits/leaks.md) | Security audit findings, numbered. Code comments cite these as "leaks.md finding #N" |
| [`LANDING_TEMPLATE_AUDIT.md`](audits/LANDING_TEMPLATE_AUDIT.md) | Landing page vs. the agency.ai template it was modelled on |
| [`OVERVIEW_TEMPLATE_AUDIT.md`](audits/OVERVIEW_TEMPLATE_AUDIT.md) | Overview page vs. the TailAdmin template |

## `history/`

**Superseded. Do not plan against these.** Kept for provenance only — see
[`history/README.md`](history/README.md).
