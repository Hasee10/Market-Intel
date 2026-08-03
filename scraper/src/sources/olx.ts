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

async function scrapeCategoryPage(categoryPath: string, page: number): Promise<RawClassifiedListing[]> {
  const url = `${BASE_URL}/${categoryPath}${page > 1 ? `?page=${page}` : ''}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`OLX category "${categoryPath}" page ${page} fetch failed: ${res.status}`);
  }
  const html = await res.text();
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
    const pageListings = await scrapeCategoryPage(categoryPath, page);
    if (pageListings.length === 0) break;
    listings.push(...pageListings);
  }
  return listings;
}

export async function scrapeOlx(): Promise<ClassifiedSourceResult> {
  const listings: RawClassifiedListing[] = [];
  const failures: string[] = [];

  for (const category of config.olxCategories) {
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
