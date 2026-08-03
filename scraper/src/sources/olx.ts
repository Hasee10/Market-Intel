import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { ClassifiedSourceResult, RawClassifiedListing } from '../types.js';

// OLX Pakistan is classifieds, not a marketplace - see migrations/007 for why
// this writes to market_classified_listings instead of market_products.
// Server-rendered, plain HTTP, no bot protection on the listing grid.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.olx.com.pk';

// A bare `User-Agent` with no `Accept`/`Accept-Language` is an obvious tell and
// a plausible reason this source started coming back empty from CI while the
// identical request succeeds from a residential connection. These are the
// headers any browser sends; nothing here is an attempt to defeat a challenge.
const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-PK,en;q=0.9',
} as const;

const MAX_PAGES = 20;

// Polite, randomised pacing between requests - CI's 429s are consistent with
// OLX rate-limiting the runner's IP rather than a one-off block, so pacing
// alone won't fix a hard IP-level limit, but it reduces how often a normal
// run trips it.
const PAGE_DELAY_MS: [number, number] = [4000, 8000];
const CATEGORY_DELAY_MS: [number, number] = [15000, 25000];

// A 429 is retried in place with exponential backoff before the page is
// treated as a failure - a few retries here is cheap insurance against a
// short-lived limit, but this is not a substitute for D4 (real IP-level
// throttling needs a proxy, not politeness).
const RATE_LIMIT_RETRY_BASE_MS = 45_000;
const RATE_LIMIT_RETRY_MAX_MS = 300_000;
const RATE_LIMIT_MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay([min, max]: [number, number]): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}

// OLX prices are shown in Pakistani shorthand ("Rs 1.25 Lac", "Rs 2.5 Crore")
// as well as plain "Rs 23,999" - handle both.
function parsePriceText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/^Rs\.?\s*/i, '').trim();

  const lacMatch = cleaned.match(/^([\d.]+)\s*Lac$/i);
  if (lacMatch) return Math.round(Number(lacMatch[1]) * 100_000);

  const croreMatch = cleaned.match(/^([\d.]+)\s*Crore$/i);
  if (croreMatch) return Math.round(Number(croreMatch[1]) * 10_000_000);

  const digits = cleaned.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

function parseListings($: cheerio.CheerioAPI, categoryPath: string): RawClassifiedListing[] {
  const listings: RawClassifiedListing[] = [];

  $('li[aria-label="Listing"]').each((_, el) => {
    const card = $(el);
    const link = card.find('a[href^="/item/"]').first();
    const href = link.attr('href');
    const title = card.find('[aria-label="Title"]').first().text().trim();
    if (!href || !title) return;

    const idMatch = href.match(/-iid-(\d+)/);
    const externalId = idMatch ? idMatch[1] : href;

    const price = parsePriceText(card.find('[aria-label="Price"]').first().text());
    const locationText = card.find('[aria-label="Location"]').first().text().trim();
    // Location text includes a trailing "•" bullet separator before the date.
    const city = locationText.replace(/•.*$/, '').trim() || undefined;
    const imageUrl = card.find('img').first().attr('src')?.trim();

    listings.push({
      externalId,
      categorySlug: categoryPath,
      title,
      url: `${BASE_URL}${href}`,
      imageUrl,
      currency: 'PKR',
      price,
      city,
    });
  });

  return listings;
}

async function fetchCategoryPageHtml(categoryPath: string, page: number): Promise<string> {
  const url = `${BASE_URL}/${categoryPath}${page > 1 ? `?page=${page}` : ''}`;

  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: REQUEST_HEADERS });

    if (res.status === 429) {
      const body = await res.text();
      if (attempt >= RATE_LIMIT_MAX_RETRIES) {
        throw new Error(`OLX category "${categoryPath}" page ${page} fetch failed: 429 (out of retries)`);
      }
      const backoff = Math.min(RATE_LIMIT_RETRY_BASE_MS * 2 ** attempt, RATE_LIMIT_RETRY_MAX_MS);
      console.warn(
        `[olx] category "${categoryPath}" page ${page}: 429, retrying in ${Math.round(backoff / 1000)}s ` +
          `(attempt ${attempt + 2}). First 250 chars: ${body.slice(0, 250).replace(/\s+/g, ' ').trim()}`,
      );
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      throw new Error(`OLX category "${categoryPath}" page ${page} fetch failed: ${res.status}`);
    }

    return res.text();
  }
}

async function scrapeCategoryPage(categoryPath: string, page: number): Promise<RawClassifiedListing[]> {
  const html = await fetchCategoryPageHtml(categoryPath, page);
  const $ = cheerio.load(html);
  const listings = parseListings($, categoryPath);

  // Selectors were verified against a real fetch of this exact category
  // (a[href^="/item/"], li[aria-label="Listing"] etc. all present) - a
  // 200 response with zero listings on page 1 most likely means OLX served
  // a different page to this request (bot-detection serving a challenge/
  // empty variant to datacenter IPs like GitHub's runners) rather than a
  // markup change. Log a snippet so a real run's logs can confirm which.
  if (page === 1 && listings.length === 0) {
    console.warn(
      `[olx] category "${categoryPath}" page 1: 0 listings parsed from a ${html.length}-byte response. ` +
        `Title tag: ${$('title').first().text().trim() || '(none)'}. ` +
        `First 300 chars of body text: ${$('body').text().trim().slice(0, 300).replace(/\s+/g, ' ')}`,
    );
  }

  return listings;
}

async function scrapeCategory(categoryPath: string): Promise<RawClassifiedListing[]> {
  const listings: RawClassifiedListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await randomDelay(PAGE_DELAY_MS);
    const pageListings = await scrapeCategoryPage(categoryPath, page);
    if (pageListings.length === 0) break;
    listings.push(...pageListings);
  }
  return listings;
}

export async function scrapeOlx(): Promise<ClassifiedSourceResult> {
  const listings: RawClassifiedListing[] = [];
  const failures: string[] = [];

  for (let i = 0; i < config.olxCategories.length; i += 1) {
    const category = config.olxCategories[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      listings.push(...(await scrapeCategory(category)));
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[olx] category "${category}" failed:`, message);
      failures.push(`${category}: ${message}`);
    }
  }

  // Swallowing every category error and returning an empty array is how this
  // source reported `product_count: 0` with no error on three consecutive runs
  // while `market_classified_listings` stayed empty - the pipeline cannot tell
  // "OLX genuinely has nothing" from "every fetch 403'd". Tolerating *some*
  // category failures is still right (one dead slug should not lose the other
  // fourteen), but a total wipeout is a source failure and must be thrown so
  // `scraper_runs.error` records it.
  if (failures.length > 0 && listings.length === 0) {
    throw new Error(
      `all ${failures.length} OLX categories failed: ${failures.slice(0, 3).join(' | ')}` +
        (failures.length > 3 ? ` (+${failures.length - 3} more)` : ''),
    );
  }
  if (failures.length > 0) {
    console.warn(`[olx] ${failures.length}/${config.olxCategories.length} categories failed but others succeeded`);
  }

  return { platformSlug: 'olx', listings };
}
