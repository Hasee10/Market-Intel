import { config } from '../config.js';
import type { RawProduct, SourceResult } from '../types.js';

// Daraz is the marketplace our sellers actually compete on (ROADMAP.md D1),
// and it is the only source so far that names the *seller* behind a listing
// rather than just the venue - which is what makes a competitor entity
// (ROADMAP.md C1) expressible at all.
//
// It is a plain HTTP source despite being the hardest site on the list. The
// category pages are an empty ICE app shell - no product markup in the HTML -
// but appending `?ajax=true` makes the same URL return the page's JSON model,
// including `mods.listItems`. That needs no browser, so Daraz sits in
// HTTP_SOURCES rather than BROWSER_SOURCES. If Daraz ever starts challenging
// this endpoint, move it to BROWSER_SOURCES and drive it through
// withBrowserSession - the parser below works unchanged on the same JSON.
//
// ROBOTS: daraz.pk/robots.txt disallows `/catalog/` and `/shop/*.htm`. That
// rules out the search endpoint (`/catalog/?q=...`), which is the obvious way
// to scrape this site, and it rules out crawling seller storefronts. Category
// paths (`/smartphones/`) are not disallowed, so this source only ever walks
// configured category paths. Do not add a keyword/search mode here, and do not
// follow sellers to their shop pages - the seller fields below already come
// from the category listing. See SCRAPING.md.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Daraz's own page size. Used with totalResults to work out how many pages a
// category actually has, because the endpoint will not tell us when we have
// run off the end - see scrapeCategory.
const PAGE_SIZE = 40;
// Lower than the other sources' 30 on purpose. Daraz is configured with ~22
// categories and is polite-delayed between pages, so the page cap is what
// keeps the whole scrape run inside the workflow timeout: 22 x 15 pages is
// ~330 requests, roughly 10 minutes. Raise this and re-check
// .github/workflows/market-scraper.yml's timeout-minutes.
const MAX_PAGES = 15;
const REQUEST_DELAY_MS = 1000;

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

async function fetchPage(categorySlug: string, pageNum: number): Promise<DarazAjaxResponse> {
  const url = `https://www.daraz.pk/${categorySlug}/?ajax=true&page=${pageNum}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Daraz category "${categorySlug}" page ${pageNum} failed: ${res.status}`);
  }
  return (await res.json()) as DarazAjaxResponse;
}

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  const seen = new Set<string>();

  // The endpoint never signals the end of a category: asking for page 60 of a
  // 54-page category still returns a full 40 items (recommendations, not
  // results). So the page count is derived from totalResults up front, and the
  // dedup check below is the backstop if that lies.
  const first = await fetchPage(categorySlug, 1);
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
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    try {
      const added = collect(await fetchPage(categorySlug, pageNum));
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
  for (const category of config.darazCategories) {
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[daraz] category "${category}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'daraz', products };
}
