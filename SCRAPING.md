# Scraping policy and source review

ROADMAP.md **D3**. Reviewed 2026-08-03 by fetching every source's live
`robots.txt` and comparing it against the URL each scraper actually requests
(`scraper/src/sources/*.ts`).

This is an engineering compliance review, not legal advice. It records what
each site publishes and where we currently stand against it.

---

## ⚠️ One source is out of compliance today

**`sapphireonline` requests paths its own `robots.txt` disallows.**

`sapphireonline.ts` paginates through the Salesforce Commerce Cloud fragment
endpoint:

```
/on/demandware.store/Sites-Sapphire-Site/default/Search-UpdateGrid?cgid=...&start=...&sz=...
```

`pk.sapphireonline.pk/robots.txt` disallows that URL five times over — via
`*demandware.store*`, `/on/demandware.store/`, `/*?*cgid=`, `/*?*start=`, and
`/*?*sz=`. It was picked because it returns clean product-tile HTML with no
JS, and the robots file was not checked at the time.

**There is a compliant alternative.** `https://pk.sapphireonline.pk/collections/<slug>`
is not disallowed and returns 200 with the same `product-tile` markup —
verified live, 26 tiles on `ready-to-wear`. Rewriting `sapphireonline.ts`
against `/collections/` needs the pagination scheme re-derived (the fragment
endpoint's `start`/`sz` will not carry over), which is why it is written up
here rather than patched inline.

Until that is done, the honest options are to fix it or to drop
`SAPPHIREONLINE_CATEGORIES` from the workflow so the source runs empty.
It is a single brand's own store and the lowest-value source we have, so
pausing it costs almost nothing.

---

## Rules the scraper follows

These are the rules the whole `scraper/` package is expected to hold to. They
are what the source-by-source table below is checked against.

1. **Read `robots.txt` before adding a source, and honour it for `User-agent: *`.**
   Not just the obvious paths — parameter-level `Disallow` rules (`/*?*cgid=`)
   count, and are how the Sapphire problem above got missed.
2. **Public listing pages only.** No login, no paywall, no checkout, no
   account, no cart. Nothing behind an authentication boundary is in scope.
3. **No personal data.** Merchant/shop names are business identities and are
   in scope. Individual classifieds posters' names, phone numbers, and
   profiles are not, and are not collected — see the OLX row below.
4. **Rate-limit and stay small.** Every source is capped by pages per category
   and runs on a 2-day cadence, not continuously. Daraz additionally delays
   1s between requests.
5. **Identify honestly.** A normal browser User-Agent, no rotation to evade
   blocks, no CAPTCHA solving. CloakBrowser is used to render JS on two sites,
   not to defeat a block that has been applied to us.
6. **Facts, not content.** We store price, title, availability, rating,
   seller, and URL — the factual attributes of an offer. We do not republish
   descriptions or reviews, and we always link back to the source listing.
7. **If a site asks us to stop, stop.** No proxy-rotation escalation.

---

## Source-by-source

| Source | `robots.txt` on our paths | Verdict |
|---|---|---|
| **daraz** | Disallows `/catalog/` and `/shop/*.htm`. Category paths (`/smartphones/`) are not disallowed. | **OK — by design.** See below. |
| **priceoye** | `Allow: /`. Cloudflare `Content-Signal: search=yes,ai-train=no,use=reference`. | OK. See "Content-Signal" below. |
| **shophive** | `Allow: /`. Same Cloudflare Content-Signal block. | OK. |
| **telemart** | `Allow: /`. Shopify default. We read `/collections/<h>/products.json`, the public Shopify JSON, which is not disallowed. Their robots explicitly forbids *automated checkout*, which we never touch. | OK. |
| **ishopping** | `Disallow:` (empty — allows everything) plus an admin path and `/lofmarketplace/`. We read category paths. | OK. |
| **goto** | **Unknown.** `robots.txt` is unfetchable — the site's TLS certificate is expired, which is also why `goto.ts` needs `ignoreHTTPSErrors`. | Unverified. Re-check when their cert is fixed. |
| **sapphireonline** | Disallows the exact endpoint we call. | **Non-compliant.** See above. |
| **olx** | Disallows `/api/`, `/post/`, `/profile/`, `/chat/`, and a long list of filter query params. We read `/<category>` with `?page=N`, none of which are disallowed. | OK. |

### Daraz specifically

Daraz was the D1 priority and is the source with the sharpest constraint, so
the reasoning is worth recording.

The natural way to scrape Daraz is the search endpoint,
`daraz.pk/catalog/?q=<term>&ajax=true`. It works, it is the cleanest JSON on
the site — and it is **disallowed**. So is `/shop/*.htm`, which rules out
walking a competitor's storefront to enumerate their catalogue.

`daraz.ts` therefore only ever walks configured **category paths**
(`daraz.pk/<slug>/?ajax=true&page=N`), which robots.txt does not restrict.
Two consequences worth knowing before someone "improves" this:

- **Do not add a keyword/search mode.** It is the obvious next feature and it
  is the disallowed one.
- **Do not follow sellers to their shop pages.** The seller name and ID we
  need for the competitor model (ROADMAP.md C1) are already present in the
  category listing response, so there is no reason to.

Daraz's ToS, like most marketplaces', prohibits automated data collection in
general terms. That is a contractual question distinct from robots.txt, and it
applies to every large source here. The mitigating position is the one in
"Rules" above: public listing pages, factual attributes, low volume, no
personal data, attributed back. Worth a lawyer's read before this is a
revenue-generating product, and worth revisiting immediately if Daraz ever
contacts us.

### Content-Signal (priceoye, shophive)

Both sit behind Cloudflare's managed content-signals block:

```
Content-Signal: search=yes,ai-train=no,use=reference
```

- `ai-train=no` — we do not train or fine-tune models on any scraped content.
  Compliant.
- `use=reference` — we cite and link back to the source listing. Compliant.
- `ai-input` — **unspecified**, which under the signal's own terms neither
  grants nor restricts. Relevant because the report generator sends aggregated
  scraped figures to Groq for narrative insight
  (`lib/reports/collect-report-data.ts`). It is aggregate numbers, not article
  text, and it is not training. Noted rather than resolved.

### OLX and personal data

OLX is classifieds, so listings are frequently posted by individuals rather
than businesses. `olx.ts` collects title, price, city, condition, and posting
date — deliberately **not** seller name, phone number, or profile URL, and
`/profile/` is disallowed anyway. Keep it that way; the value of OLX to us is
velocity and price distribution, neither of which needs a person attached.

---

## Open items

- [ ] Fix or pause `sapphireonline` (see top of this file).
- [ ] Re-check `goto.com.pk/robots.txt` once their TLS cert is renewed.
- [ ] Legal review of marketplace ToS — Daraz and OLX in particular — before
      the scraped data underpins a paid tier at any real scale.
- [ ] Decide a position on `ai-input` for the Groq report step, and publish a
      contact address so a site owner can reach us.
