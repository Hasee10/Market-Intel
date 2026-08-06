import * as cheerio from 'cheerio';
import { config } from '../config.js';
import {
  CATEGORY_DELAY_MS,
  CircuitOpenError,
  DEFAULT_HEADERS,
  PAGE_DELAY_MS,
  politeFetch,
  randomDelay,
} from './polite.js';
import type { RawProduct, SourceResult } from '../types.js';

// Naheed.pk - the online arm of a large Karachi retail chain. Matters here
// because it is the first source with real depth outside electronics:
// groceries, pharmacy, beauty, home, kids and books all have live catalogues,
// which are exactly the seller categories that had zero retailer coverage
// after OLX was disabled (ROADMAP.md D4).
//
// Magento 2, and the grid markup is the same family as ishopping.ts /
// shophive.ts - `.product-item-info` cards with `data-price-amount` on the
// price wrapper, paginated with `?p=N`. Verified live on 2026-08-03:
// /phones-tablets returned 32 cards on page 1 and a different 32 on ?p=2.
//
// ROBOTS: naheed.pk/robots.txt disallows Magento's internal plumbing
// (/catalog/product/view/, /catalog/category/view/, /catalogsearch/,
// /checkout/, /customer/, /wishlist/ and similar). The SEO category paths this
// source walks (/phones-tablets, /health-beauty, ...) are *not* disallowed -
// they are different URLs from the /catalog/category/view/ internal route.
// Do not add a /catalogsearch/ keyword mode here. Verified 2026-08-03.

const MAX_PAGES = 10;

function parsePriceAttr(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function parseCards($: cheerio.CheerioAPI, categorySlug: string): RawProduct[] {
  const products: RawProduct[] = [];

  $('.product-item-info').each((_, el) => {
    const card = $(el);
    const link = card.find('a.product-item-link').first();
    const href = link.attr('href');
    const title = link.text().trim();
    if (!href || !title) return;

    // Magento renders the price as a formatted string plus a machine-readable
    // `data-price-amount` attribute; prefer the attribute so there is no
    // currency-symbol or thousand-separator parsing to get wrong.
    const price = parsePriceAttr(
      card.find('.price-box .price-wrapper').first().attr('data-price-amount'),
    );
    const compareAtPrice = parsePriceAttr(
      card.find('.old-price .price-wrapper').first().attr('data-price-amount'),
    );

    products.push({
      // Naheed's grid has no SKU input in the card (unlike ishopping), so the
      // product URL is the stable identity. It is the canonical PDP link, not
      // a search result, so it does not carry query noise.
      externalId: href,
      categorySlug,
      title,
      url: href,
      imageUrl: card.find('.product-image-photo').first().attr('src')?.trim(),
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      // Magento's default catalogue only lists enabled/salable products in the
      // grid - same assumption already made for shophive and ishopping.
      inStock: true,
    });
  });

  return products;
}

async function scrapeCategory(categoryPath: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  const seen = new Set<string>();

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
    if (pageNum > 1) await randomDelay(PAGE_DELAY_MS);

    const url = `https://www.naheed.pk/${categoryPath}${pageNum > 1 ? `?p=${pageNum}` : ''}`;
    const res = await politeFetch(url, `naheed ${categoryPath} p${pageNum}`, DEFAULT_HEADERS, 'naheed');
    const $ = cheerio.load(await res.text());
    const pageProducts = parseCards($, categoryPath);

    const fresh = pageProducts.filter((p) => !seen.has(p.externalId));
    if (fresh.length === 0) break;

    fresh.forEach((p) => seen.add(p.externalId));
    products.push(...fresh);
  }

  return products;
}

export async function scrapeNaheed(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  for (let i = 0; i < config.naheedCategories.length; i += 1) {
    const category = config.naheedCategories[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[naheed] category "${category}" failed:`, (err as Error).message);
      if (err instanceof CircuitOpenError) break;
    }
  }

  return { platformSlug: 'naheed', products };
}
