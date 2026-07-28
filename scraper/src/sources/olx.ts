import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { ClassifiedSourceResult, RawClassifiedListing } from '../types.js';

// OLX Pakistan is classifieds, not a marketplace - see migrations/007 for why
// this writes to market_classified_listings instead of market_products.
// Server-rendered, plain HTTP, no bot protection on the listing grid.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.olx.com.pk';

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
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`OLX category "${categoryPath}" page ${page} fetch failed: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  return parseListings($, categoryPath);
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
  for (const category of config.olxCategories) {
    try {
      listings.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[olx] category "${category}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'olx', listings };
}
