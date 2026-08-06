import { config } from '../config.js';
import { withBrowserSession } from './browser/session.js';
import type { RawProduct, SourceResult } from '../types.js';
import type { Page } from 'playwright-core';

// Daraz is the marketplace our sellers actually compete on (ROADMAP.md D1),
// and it is the only source so far that names the *seller* behind a listing
// rather than just the venue - which is what makes a competitor entity
// (ROADMAP.md C1) expressible at all.
//
// The category pages are an empty ICE app shell - no product markup in the
// HTML - but appending `?ajax=true` makes the same URL return the page's
// JSON model, including `mods.listItems`. That endpoint is fetched through
// CloakBrowser (real browser navigation, not a bare Node fetch) rather than
// plain HTTP: under load, Daraz started answering some category/page
// requests with a challenge/HTML page instead of the JSON model, which a
// stealth browser session is far less likely to trigger. Every request below
// goes through the same withBrowserSession page - never fall back to a plain
// `fetch()` for this source.
//
// ROBOTS: daraz.pk/robots.txt disallows `/catalog/` and `/shop/*.htm`. That
// rules out the search endpoint (`/catalog/?q=...`), which is the obvious way
// to scrape this site, and it rules out crawling seller storefronts. Category
// paths (`/smartphones/`) are not disallowed, so this source only ever walks
// configured category paths. Do not add a keyword/search mode here, and do not
// follow sellers to their shop pages - the seller fields below already come
// from the category listing. See SCRAPING.md.

// Daraz's own page size. Used with totalResults to work out how many pages a
// category actually has, because the endpoint will not tell us when we have
// run off the end - see scrapeCategory.
const PAGE_SIZE = 40;
// Lower than the other sources' 30 on purpose. Daraz is configured with ~22
// categories and is polite-delayed between pages, so the page cap is what
// keeps the whole scrape run inside the workflow timeout. Raise this and
// re-check .github/workflows/market-scraper.yml's timeout-minutes.
const MAX_PAGES = 15;

// Polite, randomised pacing rather than a fixed delay - a fixed interval is
// itself a bot signal, and a fixed delay that's too short is what let Daraz
// start answering some requests with a challenge page under sustained load.
const PAGE_DELAY_MS: [number, number] = [2500, 6000];
const CATEGORY_DELAY_MS: [number, number] = [8000, 15000];

// A failed page is retried in place (increasing backoff) before the category
// gives up on it, since a single challenge page is often transient.
const PAGE_RETRY_BACKOFFS_MS = [15_000, 45_000, 90_000];
const MAX_RETRY_AFTER_MS = 120_000;

// If this many categories in a row fail outright (all of their own page
// retries exhausted), Daraz is genuinely blocking this run - stop trying
// the remaining categories rather than working through the same wall one
// by one. Same idea as polite.ts's per-platform circuit breaker, kept as a
// local counter here since this file doesn't share polite.ts's module
// (Daraz goes through CloakBrowser, not politeFetch).
const MAX_CONSECUTIVE_CATEGORY_FAILURES = 3;

function parseRetryAfterMs(value: string | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? Math.min(delta, MAX_RETRY_AFTER_MS) : 0;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay([min, max]: [number, number]): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}

interface DarazListItem {
  nid?: string;
  itemId?: string;
  name?: string;
  brandName?: string;
  itemUrl?: string;
  image?: string;
  price?: string;
  originalPrice?: string;
  inStock?: boolean;
  ratingScore?: string;
  review?: string;
  sellerName?: string;
  sellerId?: string;
  itemSoldCntShow?: string;
  isSponsored?: boolean;
}

interface DarazAjaxResponse {
  mods?: { listItems?: DarazListItem[] };
  mainInfo?: { totalResults?: string; pageSize?: string };
}

function parseNumber(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function roundTo2(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}

function parseIntFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

// "6 sold", "1.2K sold", "" - the only demand-side signal any of our sources
// expose. Deliberately coarse and rounded by Daraz itself, so it is a proxy
// and is labelled as one everywhere it surfaces (ROADMAP.md gap #3), never
// presented as unit sales.
function parseSoldCount(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = /([\d.]+)\s*([KkMm]?)/.exec(text);
  if (!match) return undefined;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const multiplier = match[2].toLowerCase() === 'k' ? 1000 : match[2].toLowerCase() === 'm' ? 1_000_000 : 1;
  return Math.round(base * multiplier);
}

function absoluteUrl(itemUrl: string): string {
  // Daraz returns protocol-relative URLs ("//www.daraz.pk/products/...").
  if (itemUrl.startsWith('//')) return `https:${itemUrl}`;
  if (itemUrl.startsWith('http')) return itemUrl;
  return `https://www.daraz.pk${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`;
}

function toProduct(item: DarazListItem, categorySlug: string): RawProduct | undefined {
  const externalId = item.nid ?? item.itemId;
  const title = item.name?.trim();
  if (!externalId || !title || !item.itemUrl) return undefined;

  const price = parseNumber(item.price);
  const compareAtPrice = parseNumber(item.originalPrice);

  return {
    externalId,
    categorySlug,
    title,
    // Daraz uses the literal string "No Brand" for unbranded listings, which
    // would otherwise become a brand with thousands of products behind it.
    brand: item.brandName && item.brandName !== 'No Brand' ? item.brandName : undefined,
    url: absoluteUrl(item.itemUrl),
    imageUrl: item.image,
    currency: 'PKR',
    price,
    compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
    inStock: item.inStock,
    // Daraz returns the raw mean ("4.749748743718593"); every other source
    // gives a display rating, so round to match rather than storing noise.
    rating: roundTo2(parseNumber(item.ratingScore)),
    ratingCount: parseIntFromText(item.review),
    sellerName: item.sellerName?.trim() || undefined,
    sellerExternalId: item.sellerId || undefined,
    soldCount: parseSoldCount(item.itemSoldCntShow),
  };
}

// A 200 response whose body starts with `<` (or clearly embeds a `<script`
// tag) is Daraz's challenge/app-shell page, not the AJAX JSON model - trying
// to JSON.parse it is what produced "Unexpected token '<'" failures. Treat
// it as a soft failure so the retry loop below can back off and try again,
// same as an actual non-2xx status.
function looksLikeBlockPage(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<') || trimmed.includes('<script');
}

function snippet(text: string): string {
  return text.slice(0, 300).replace(/\s+/g, ' ').trim();
}

// Fetched via real browser navigation (not page.evaluate + fetch) so the
// response is read from CloakBrowser's own network stack, including its
// stealth TLS/header fingerprint - and so it needs no separate same-origin
// dance before the first request.
async function fetchPage(page: Page, categorySlug: string, pageNum: number): Promise<DarazAjaxResponse> {
  const url = `https://www.daraz.pk/${categorySlug}/?ajax=true&page=${pageNum}`;

  for (let attempt = 0; ; attempt += 1) {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const status = response?.status() ?? 0;
    const text = response ? await response.text() : '';
    const ok = status >= 200 && status < 300 && !looksLikeBlockPage(text);

    if (ok) {
      try {
        return JSON.parse(text) as DarazAjaxResponse;
      } catch (err) {
        console.warn(
          `[daraz] category "${categorySlug}" page ${pageNum}: 200 response was not valid JSON. ` +
            `First 300 chars: ${snippet(text)}`,
        );
        // Falls through to the retry/backoff below, same as a block page.
      }
    } else if (attempt === 0) {
      // Only log the first occurrence per page in detail, so a fully-dead
      // category doesn't spam the log once per retry as well as once per page.
      console.warn(
        `[daraz] category "${categorySlug}" page ${pageNum}: status ${status}, ` +
          `${looksLikeBlockPage(text) ? 'looks like a block/challenge page' : 'non-2xx'}. ` +
          `First 300 chars: ${snippet(text)}`,
      );
    }

    if (attempt >= PAGE_RETRY_BACKOFFS_MS.length) {
      throw new Error(
        `Daraz category "${categorySlug}" page ${pageNum} failed after ${attempt + 1} attempts (status ${status})`,
      );
    }

    // A 429 response's Retry-After (if Daraz sends one) is a more reliable
    // signal than the fixed backoff ladder - respected when present, falling
    // back to the ladder otherwise.
    const retryAfterMs = status === 429 ? parseRetryAfterMs(response?.headers()['retry-after']) : null;
    const backoff = retryAfterMs ?? PAGE_RETRY_BACKOFFS_MS[attempt];
    console.warn(
      `[daraz] category "${categorySlug}" page ${pageNum} retrying in ${(backoff / 1000).toFixed(1)}s (attempt ${attempt + 2})${retryAfterMs != null ? ' [Retry-After]' : ''}`,
    );
    await sleep(backoff);
  }
}

async function scrapeCategory(page: Page, categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  const seen = new Set<string>();

  // The endpoint never signals the end of a category: asking for page 60 of a
  // 54-page category still returns a full 40 items (recommendations, not
  // results). So the page count is derived from totalResults up front, and the
  // dedup check below is the backstop if that lies.
  const first = await fetchPage(page, categorySlug, 1);
  const total = parseNumber(first.mainInfo?.totalResults) ?? 0;
  const pageSize = parseNumber(first.mainInfo?.pageSize) ?? PAGE_SIZE;
  const lastPage = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / pageSize)));

  const collect = (response: DarazAjaxResponse): number => {
    let added = 0;
    for (const item of response.mods?.listItems ?? []) {
      // Sponsored slots are paid placements injected into the grid, not the
      // category's organic assortment - counting them would inflate a
      // seller's apparent share of the category.
      if (item.isSponsored) continue;
      const product = toProduct(item, categorySlug);
      if (!product || seen.has(product.externalId)) continue;
      seen.add(product.externalId);
      products.push(product);
      added += 1;
    }
    return added;
  };

  collect(first);

  for (let pageNum = 2; pageNum <= lastPage; pageNum += 1) {
    await randomDelay(PAGE_DELAY_MS);
    try {
      const added = collect(await fetchPage(page, categorySlug, pageNum));
      if (added === 0) break;
    } catch (err) {
      console.error(`[daraz] category "${categorySlug}" page ${pageNum} failed:`, (err as Error).message);
      break;
    }
  }

  return products;
}

export async function scrapeDaraz(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  // One page for the whole run, walked sequentially (no concurrency) - a
  // fresh page per category would mean a fresh CloakBrowser session look
  // more often, which is closer to bot-like behaviour, not less.
  await withBrowserSession(async (browser) => {
    const page = await browser.newPage();

    let consecutiveFailures = 0;
    for (let i = 0; i < config.darazCategories.length; i += 1) {
      const category = config.darazCategories[i];
      if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
      try {
        products.push(...(await scrapeCategory(page, category)));
        consecutiveFailures = 0;
      } catch (err) {
        console.error(`[daraz] category "${category}" failed:`, (err as Error).message);
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_CATEGORY_FAILURES) {
          console.warn(
            `[daraz] ${consecutiveFailures} categories in a row failed outright - stopping the remaining ` +
              `${config.darazCategories.length - i - 1} categories this run rather than hammering a block.`,
          );
          break;
        }
      }
    }

    await page.close();
  });

  return { platformSlug: 'daraz', products };
}
