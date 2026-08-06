import * as cheerio from 'cheerio';
import { config } from '../config.js';
import {
  CATEGORY_DELAY_MS,
  CircuitOpenError,
  DEFAULT_HEADERS,
  PAGE_DELAY_MS,
  parsePriceText,
  politeFetch,
  randomDelay,
} from './polite.js';
import type { RawProduct, SourceResult } from '../types.js';

// Mega.pk - long-running Pakistani electronics retailer (laptops, mobiles,
// cameras, appliances). Server-rendered HTML, no bot protection on the
// category grid, and it publishes a spec list per card which makes the titles
// unusually clean to match on.
//
// ROBOTS: mega.pk/robots.txt is `Allow: /` for all agents, disallowing only
// /cart/, /checkout/, /login/, /register/, /wishlist/, /my/, /account/,
// /admin/ and some malformed-URL patterns. Category paths are explicitly
// crawlable. This source only ever requests configured category paths - do not
// add cart/account/search paths here. Verified 2026-08-03.
//
// Structure verified live against https://www.mega.pk/laptops/ on 2026-08-03:
// 32 `.lap_thu_box` cards per page, `?page=N` returns a genuinely different
// page (page 1 led with product 26785, page 2 with 27026).

const MAX_PAGES = 12;

// Product URLs look like
// https://www.mega.pk/laptop_products/26583/Apple-MacBook-Air-13-....html
// The numeric segment is Mega's own stable product id.
function externalIdFromUrl(url: string): string | undefined {
  const match = /\/[a-z_]+\/(\d+)\//i.exec(url);
  return match ? match[1] : undefined;
}

function parseCards($: cheerio.CheerioAPI, categorySlug: string): RawProduct[] {
  const products: RawProduct[] = [];

  $('.lap_thu_box').each((_, el) => {
    const card = $(el);
    const link = card.find('#lap_name_div h3 a').first();
    const href = link.attr('href');
    const title = link.text().trim();
    if (!href || !title) return;

    const externalId = externalIdFromUrl(href);
    if (!externalId) return;

    // `.cat_price` holds the current price as a bare text node, with the
    // struck-through previous price nested in `.was`. Clone and drop `.was`
    // first, otherwise both numbers concatenate into one nonsense figure.
    const priceBox = card.find('.cat_price').first().clone();
    const compareAtPrice = parsePriceText(priceBox.find('.was').text());
    priceBox.find('.was').remove();
    const price = parsePriceText(priceBox.text());

    products.push({
      externalId,
      categorySlug,
      title,
      // The `li` wrapping each card carries a data-brand attribute.
      brand: card.closest('li').attr('data-brand')?.trim() || undefined,
      url: href,
      imageUrl: card.find('.image img').first().attr('src')?.trim(),
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      // No per-card stock badge on the grid; a listed item is purchasable,
      // same assumption as shophive/ishopping.
      inStock: true,
    });
  });

  return products;
}

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  const seen = new Set<string>();

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
    if (pageNum > 1) await randomDelay(PAGE_DELAY_MS);

    const url = `https://www.mega.pk/${categorySlug}/${pageNum > 1 ? `?page=${pageNum}` : ''}`;
    const res = await politeFetch(url, `mega ${categorySlug} p${pageNum}`, DEFAULT_HEADERS, 'mega');
    const $ = cheerio.load(await res.text());
    const pageProducts = parseCards($, categorySlug);

    // Running off the end of a category re-serves the last page rather than
    // an empty one, so stop on "nothing new" as well as "nothing at all".
    const fresh = pageProducts.filter((p) => !seen.has(p.externalId));
    if (fresh.length === 0) break;

    fresh.forEach((p) => seen.add(p.externalId));
    products.push(...fresh);
  }

  return products;
}

export async function scrapeMega(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  for (let i = 0; i < config.megaCategories.length; i += 1) {
    const category = config.megaCategories[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[mega] category "${category}" failed:`, (err as Error).message);
      // The platform is genuinely blocking this run (politeFetch's
      // per-platform circuit breaker tripped) - stop trying the remaining
      // categories rather than hammering them one by one for the same result.
      if (err instanceof CircuitOpenError) break;
    }
  }

  return { platformSlug: 'mega', products };
}
