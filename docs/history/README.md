# History — superseded, kept for provenance

**Nothing in this directory describes the current system. Do not plan against
it.** [`ROADMAP.md`](../../ROADMAP.md) is the source of truth for what gets
built next; [`FEATURES.md`](../../FEATURES.md) is the source of truth for what
exists today.

These files are kept because code comments and migration headers still cite
them by name, and because they record *why* certain decisions were made.

`ROADMAP.md` says so itself:

> **It supersedes** `new_implementation_doc.md` and `implementation_status.txt`,
> both of which describe Phases 1–5 as future work that has since largely been
> built, and both of which assume a seller-ops-first product we have now
> decided against. Keep `overview.md` and `research.md` as historical product
> context only. Do not plan against the superseded docs.

| File | What it was | Why it is dead |
|---|---|---|
| `new_implementation_doc.md` | Phase 1–5 implementation plan | Phases largely built; assumes a seller-ops-first product that was decided against 2026-08-03 |
| `implementation_status.txt` | Progress tracker for those phases | Same, and stale |
| `overview.md` | Original product/build planning | Predates the market-intelligence-first positioning |
| `research.md` | Original market research | Historical context only |
| `new_feature.md` | An earlier feature proposal round | Folded into `ROADMAP.md` |
| `archived-workflows/` | The original GitHub Actions workflows | Superseded by `.github/workflows/`, which is the only path GitHub reads |

## About `archived-workflows/`

These were never active from this location — GitHub only executes workflows in
`.github/workflows/`. Their own header said as much:

> this workflow isn't active anywhere until it's copied into
> `.github/workflows/` of wherever Market Intel actually gets deployed

`market-alerts-cron.yml` additionally pointed at a JobLo Vercel URL that no
longer serves the route. Price alerts are now triggered by
`.github/workflows/market-intel-cron.yml` on a 6-hourly schedule.

Having a second `workflows/` directory at the repo root was a standing source
of confusion — it looked active and was not.
