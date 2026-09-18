# Mobile API — changelog

What changed in the `/api/mobile/*` contract, newest first. The full contract is [MOBILE_API_READY.md](MOBILE_API_READY.md); this is the diff between versions of it.

**If you are the mobile client developer:** you never need to change a URL, a header, or a request body because of anything here unless an entry says so in bold.

---

## 2026-09-18

### Fixed — every endpoint built on shared lib functions returned empty data for a real token

**Nothing to change on the client.**

Affected: `/pulse`, `/categories`, `/kpis`, `/market`, `/competitors`, `/competitors/moves`, `/pricing`, `/search`, `/products/{id}/insight`.

With a valid bearer token for an account that has data on the web, these returned empty lists, zero counts, or `domain: null`. The server was opening a cookie-session database client on a request that has no cookie, so every seller-scoped query ran with no user and row-level security filtered every row. No error was raised; the response was just empty.

The four routes that were already correct: `/alerts`, `/alerts/read`, `/devices`, `/products`.

Fixed server-side in one place. The same calls now return the same data the web app shows for that account.

### Added — `emptyReason` on `GET /api/mobile/categories`

**Optional to read. Existing clients are unaffected.**

```jsonc
{
  "categories": [ /* … */ ],
  "emptyReason": null          // "no_tracked_markets" when categories is []
}
```

`no_tracked_markets` means the account has not picked a market yet — the same state as `domain: null` on `/pulse`. It is a correct answer, not an error. Show "choose a market on the web app", not "no data".

Reminder from the contract, since it was the source of confusion: this endpoint returns the **markets the seller tracks**, not the categories their products are in. An account can have products in twenty categories and track one market. On the free plan it is always at most one.

### Docs

- New: [MOBILE_AUTH.md](MOBILE_AUTH.md) — how a phone gets the token. There is no Ryvl login endpoint; login and signup are Supabase Auth called directly, with the exact calls and response bodies.
- `MOBILE_API.md`, `MOBILE_API_READY.md`, `openapi-mobile.yaml` — `/categories` section rewritten to say what it returns and carry `emptyReason`.
