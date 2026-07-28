import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { RawProduct, SourceResult } from '../types.js';

// Sapphireonline.pk is Salesforce Commerce Cloud (Demandware) - plain HTTP,
// no bot protection. Category grids paginate via the SFCC Search-UpdateGrid
// fragment endpoint, which returns raw product-tile HTML (no JS needed).

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://pk.sapphireonline.pk';

const PAGE_SIZE = 12;
const MAX_PAGES = 30;

function parsePriceAttr(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

// Sapphireonline is a single brand's own store (not a marketplace) - this is
// tracked as a brand-monitoring source rather than a price-comparison one.
async function scrapeCategoryPage(categorySlug: string, start: number): Promise<RawProduct[]> {
  const url = `${BASE_URL}/on/demandware.store/Sites-Sapphire-Site/default/Search-UpdateGrid?cgid=${categorySlug}&start=${start}&sz=${PAGE_SIZE}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Sapphireonline category "${categorySlug}" start ${start} fetch failed: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const products: RawProduct[] = [];

  $('.product').each((_, el) => {
    const card = $(el);
    const externalId = card.attr('data-pid');
    if (!externalId) return;

    const link = card.find('.pdp-link a.link').first();
    const title = link.text().trim();
    const href = link.attr('href');
    if (!href || !title) return;

    const priceBlock = card.find('.price').first();
    const price = parsePriceAttr(priceBlock.find('.sales .value.cc-price').first().attr('content'));
    const compareAtPrice = parsePriceAttr(
      priceBlock.find('.strike-through .value.cc-price').first().attr('content'),
    );

    const imageUrl = card.find('.tile-image').first().attr('data-src')?.trim();

    products.push({
      externalId,
      categorySlug,
      title,
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      imageUrl,
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      // No per-item stock markup in the SFCC search grid - listed items are
      // treated as in stock.
      inStock: true,
    });
  });

  return products;
}

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    const pageProducts = await scrapeCategoryPage(categorySlug, start);
    if (pageProducts.length === 0) break;
    products.push(...pageProducts);
    if (pageProducts.length < PAGE_SIZE) break;
  }
  return products;
}

export async function scrapeSapphireonline(): Promise<SourceResult> {
  const products: RawProduct[] = [];
  for (const category of config.sapphireonlineCategories) {
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[sapphireonline] category "${category}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'sapphireonline', products };
}
