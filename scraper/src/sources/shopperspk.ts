import { config } from '../config.js';
import { CATEGORY_DELAY_MS, CircuitOpenError, JSON_HEADERS, PAGE_DELAY_MS, politeFetch, randomDelay } from './polite.js';
import type { RawProduct, SourceResult } from '../types.js';

// ShoppersPK - general-merchandise retailer with real depth in home, kitchen,
// beauty and lifestyle. Like naheed.ts, its value here is category coverage
// outside electronics rather than another set of phone prices.
//
// WooCommerce, read through the public Store API
// (`/wp-json/wc/store/products`). That endpoint is part of WooCommerce's own
// storefront contract - it is what the site's own product grid calls - so it
// returns clean structured JSON including a machine-readable price, stock flag
// and category, with no markup parsing at all.
//
// Prices come as minor units governed by `currency_minor_unit`; this store
// reports PKR with minor_unit 0, but the conversion below is done properly
// rather than assumed, so a future change to 2 does not silently inflate every
// price by 100x.
//
// ROBOTS (verified 2026-08-03): `User-agent: *` is `Allow: /`, so this source
// is permitted. Two things to respect and not quietly undo:
//   - The file sets `Content-Signal: search=yes,ai-train=no,use=reference`.
//     Reading prices to show a seller what their market costs is "reference"
//     use and is permitted; do NOT feed this source's rows into model training.
//   - It separately Disallows a list of named AI crawlers (ClaudeBot, GPTBot,
//     CCBot, Google-Extended, Bytespider, ...). This scraper is none of those
//     and does not identify as one; do not change its User-Agent to any of
//     them, which would move it into an explicitly disallowed bucket.

interface WooImage {
  src: string;
}

interface WooCategory {
  name: string;
  slug: string;
}

interface WooPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_minor_unit: number;
}

interface WooProduct {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices?: WooPrices;
  images?: WooImage[];
  categories?: WooCategory[];
  is_in_stock?: boolean;
}

const PER_PAGE = 100;
const MAX_PAGES = 10;

// WooCommerce reports money in minor units: "17500" with minor_unit 0 is
// Rs 17,500, but the same string with minor_unit 2 would be Rs 175.00.
function toMajorUnits(raw: string | undefined, minorUnit: number): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return minorUnit > 0 ? value / 10 ** minorUnit : value;
}

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await randomDelay(PAGE_DELAY_MS);

    const url =
      `https://www.shopperspk.com/wp-json/wc/store/products` +
      `?per_page=${PER_PAGE}&page=${page}&category=${encodeURIComponent(categorySlug)}`;
    const res = await politeFetch(url, `shopperspk ${categorySlug} p${page}`, JSON_HEADERS, 'shopperspk');
    const data = (await res.json()) as WooProduct[];
    if (!Array.isArray(data) || data.length === 0) break;

    for (const p of data) {
      if (!p.name || !p.permalink) continue;

      const minorUnit = p.prices?.currency_minor_unit ?? 0;
      const price = toMajorUnits(p.prices?.price, minorUnit);
      const regularPrice = toMajorUnits(p.prices?.regular_price, minorUnit);

      products.push({
        externalId: String(p.id),
        categorySlug,
        title: p.name,
        url: p.permalink,
        imageUrl: p.images?.[0]?.src,
        galleryUrls: p.images && p.images.length > 1 ? p.images.map((img) => img.src) : undefined,
        currency: p.prices?.currency_code || 'PKR',
        price,
        // Only a genuine markdown counts as a compare-at price; WooCommerce
        // reports regular_price === price when nothing is on sale.
        compareAtPrice: regularPrice && price != null && regularPrice > price ? regularPrice : undefined,
        inStock: p.is_in_stock,
      });
    }

    if (data.length < PER_PAGE) break;
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
      console.error(`[shopperspk] category "${category}" failed:`, (err as Error).message);
      if (err instanceof CircuitOpenError) break;
    }
  }

  return { platformSlug: 'shopperspk', products };
}
