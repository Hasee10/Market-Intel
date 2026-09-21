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

// ShoppersPK - general-merchandise retailer with real depth in home, kitchen,
// beauty and lifestyle. Like naheed.ts, its value here is category coverage
// outside electronics rather than another set of phone prices.
//
// REWRITTEN 2026-09-21. The first version (2026-08-03) read WooCommerce's
// Store API. Some time before 2026-09-18 the site moved off WordPress onto
// a custom ERP storefront: every /wp-json/* path now returns an error page
// from any IP (403 from the runner, 400 locally), so the two runs that
// logged "403" were reading a dead endpoint, not being blocked. The new site
// renders its product grid server-side at /category/<path>/ with path-form
// pagination (/page/N/), and that HTML is what this reads now. Same platform
// slug and the same category slugs as before, so market_category_map
// (migration 023) and the price history carry on unchanged; product ids are
// the new site's ids, so listings first seen under the old ids go stale on
// the first run and are replaced.
//
// ROBOTS (re-verified 2026-09-21, and this is a tighter file than before):
//   - `Disallow: /api/`  - the storefront has a JSON API behind its infinite
//     scroll. It is off limits. Do not "upgrade" this source to use it.
//   - `Disallow: /*?*`   - any URL with a query string. Pagination MUST stay
//     in the path form used below; never add ?page= or ?sort=.
//   - /category/ paths are allowed, which is all this source touches.
//   The old Content-Signal / named-AI-crawler lines are gone from the new
//   file; the original rule still stands - this scraper identifies as
//   nothing but a browser, and its rows are reference data, not training.
//
// What a card does and does not say (checked on live pages):
//   - "Rs. 1,050" with an optional "was Rs. 1,500" - price and compare-at.
//   - "From Rs. X" + "Select Options" - a variable product; cheapest price.
//   - "Call for Price" - no price; skipped, same as the Shopify sources.
//   - Nothing about stock. The listing page has no sold-out marker at all,
//     so inStock is left undefined (unknown) rather than assumed true.

const MAX_PAGES = 30;
const BASE_URL = 'https://www.shopperspk.com';

/**
 * Config entries are `slug` or `slug=path`. The slug is ours (what
 * market_category_map and every existing row are keyed on); the path is
 * where the new site keeps that category, e.g.
 * `mugs-in-pakistan=kitchen/serveware/cups-mugs/mugs-in-pakistan`. A bare
 * slug is used as its own path, which is right for top-level categories
 * like `baby`.
 */
function parseCategoryEntry(entry: string): { slug: string; path: string } {
  const [slug, path] = entry.split('=');
  return { slug: slug.trim(), path: (path ?? slug).trim().replace(/^\/+|\/+$/g, '') };
}

function parseCards(html: string, categorySlug: string): RawProduct[] {
  const $ = cheerio.load(html);
  const products: RawProduct[] = [];

  $('.smyths-plp-card').each((_, el) => {
    const card = $(el);
    const link = card.find('a.smyths-card-link-wrap').attr('href');
    const id = card.find('[data-wishlist-btn]').attr('data-wishlist-btn');
    const title = card.find('.smyths-card-product-title').attr('title')?.trim() || card.find('.smyths-card-product-title').text().trim();
    if (!link || !id || !title) return;

    // "Call for Price" cards carry no number; parsePriceText returns
    // undefined for them and they are dropped below.
    const priceMain = card.find('.smyths-price-main').first();
    const price = parsePriceText(priceMain.text());
    if (!price) return;
    const wasPrice = parsePriceText(card.find('.smyths-was-price').first().text());

    const img = card.find('img.smyths-card-img').attr('src');

    products.push({
      externalId: id,
      categorySlug,
      title,
      url: link.startsWith('http') ? link : `${BASE_URL}${link}`,
      imageUrl: img ? (img.startsWith('http') ? img : `${BASE_URL}${img}`) : undefined,
      currency: 'PKR',
      price,
      compareAtPrice: wasPrice && wasPrice > price ? wasPrice : undefined,
    });
  });

  return products;
}

async function scrapeCategory(entry: string): Promise<RawProduct[]> {
  const { slug, path } = parseCategoryEntry(entry);
  const products: RawProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await randomDelay(PAGE_DELAY_MS);

    const url = page === 1 ? `${BASE_URL}/category/${path}/` : `${BASE_URL}/category/${path}/page/${page}/`;
    const res = await politeFetch(url, `shopperspk ${slug} p${page}`, DEFAULT_HEADERS, 'shopperspk');
    const html = await res.text();
    const pageProducts = parseCards(html, slug);
    if (pageProducts.length === 0) break;
    products.push(...pageProducts);

    // The pager links every page it knows about; when the next one is not
    // linked from this page, this is the last page.
    if (!html.includes(`/category/${path}/page/${page + 1}/`)) break;
  }

  return products;
}

export async function scrapeShopperspk(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  for (let i = 0; i < config.shopperspkCategories.length; i += 1) {
    const category = config.shopperspkCategories[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[shopperspk] category "${parseCategoryEntry(category).slug}" failed:`, (err as Error).message);
      if (err instanceof CircuitOpenError) break;
    }
  }

  return { platformSlug: 'shopperspk', products };
}
