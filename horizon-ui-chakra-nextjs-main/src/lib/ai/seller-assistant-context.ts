'server-only';

import { createClient } from '@/lib/supabase/server';
import { getPrimaryDomain, type Seller } from '@/lib/market-intel/seller/seller';
import { getCompetitorLandscape } from '@/lib/market-intel/market/competitors';
import { listWatchlists } from '@/lib/market-intel/seller/watchlists';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { findCompetitorsForProduct } from '@/lib/market-intel/market/product-matching';
import { tokenize, jaccard, MIN_CONFIDENCE } from '@/lib/market-intel/core/similarity';

// Grounds the seller assistant (seller-assistant.ts) in the seller's own
// data. Each source is capped and pre-aggregated - never a raw table dump -
// both to keep the prompt small and because the model doesn't need every
// column, just enough to answer directionally. Sections are ordered
// most-essential-first; buildSellerContextBlock() drops from the end when
// the combined text would exceed CONTEXT_CHAR_CAP, so a seller with no
// watchlist or no mentioned product just gets a shorter, still-useful block
// instead of an error.

const MAX_PRODUCTS = 15;
const MAX_SCORECARDS = 6;
const MAX_COMPETITOR_MATCHES_FOR_CHAT = 5;
const CONTEXT_CHAR_CAP = 4000;

type ProductRow = {
  id: string;
  sku: string | null;
  title: string;
  sellPrice: number | null;
  costPrice: number | null;
  currency: string;
  stockQty: number | null;
};

async function loadProducts(sellerId: string): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_products')
    .select('id, sku, title, sell_price, cost_price, currency, stock_qty')
    .eq('seller_id', sellerId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_PRODUCTS);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    sku: row.sku,
    title: row.title,
    sellPrice: row.sell_price != null ? Number(row.sell_price) : null,
    costPrice: row.cost_price != null ? Number(row.cost_price) : null,
    currency: row.currency ?? 'PKR',
    stockQty: row.stock_qty != null ? Number(row.stock_qty) : null,
  }));
}

function buildProductsBlock(products: ProductRow[], currency: string): string {
  if (products.length === 0) return 'Store products: none added yet.';

  const lines = products.map((p) => {
    const margin =
      p.sellPrice != null && p.costPrice != null && p.sellPrice > 0
        ? `${(((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0)}% margin`
        : 'margin unknown';
    const price = p.sellPrice != null ? `${p.sellPrice} ${p.currency}` : 'no price set';
    const stock = p.stockQty != null ? `${p.stockQty} in stock` : 'stock unknown';
    return `- ${p.title}${p.sku ? ` (SKU ${p.sku})` : ''}: ${price}, ${margin}, ${stock}`;
  });

  return `Store products (most recently updated, up to ${MAX_PRODUCTS}, reporting currency ${currency}):\n${lines.join('\n')}`;
}

async function buildMarketScopeBlock(sellerId: string, categorySlug: string): Promise<string> {
  try {
    const scope = await getMarketScope(categorySlug, sellerId);
    if (!scope.hasTaxonomy) return 'Market definition: no taxonomy for this category yet.';
    const { definition } = scope;
    const priceBand =
      definition.priceMin != null || definition.priceMax != null
        ? `price band ${definition.priceMin ?? 'any'}-${definition.priceMax ?? 'any'} ${definition.priceCurrency}`
        : 'no price band set';
    const segments = definition.isDefault
      ? 'every mapped segment (default, not narrowed)'
      : `${scope.activeSegments.length} of ${scope.allSegments.length} mapped segments`;
    return `Market definition: tracking ${segments}, ${priceBand}.`;
  } catch {
    return 'Market definition: unavailable right now.';
  }
}

async function buildCompetitorLandscapeBlock(sellerId: string, categorySlug: string, currency: string): Promise<string> {
  try {
    const landscape = await getCompetitorLandscape(categorySlug, currency, sellerId);
    if (landscape.scorecards.length === 0) return 'Competitor landscape: no named competitors in scope yet.';

    const top = landscape.scorecards.slice(0, MAX_SCORECARDS);
    const lines = top.map((c) => {
      const index = c.priceIndex != null ? `${c.priceIndex > 0 ? '+' : ''}${(c.priceIndex * 100).toFixed(0)}% vs market median` : 'price index unknown';
      const stock = c.inStockRate != null ? `${(c.inStockRate * 100).toFixed(0)}% in stock` : 'stock unknown';
      return `- ${c.name} (${c.platformName}): ${c.skuCount} SKUs, ${index}, ${stock}`;
    });
    return `Top competitors in your market (up to ${MAX_SCORECARDS}):\n${lines.join('\n')}`;
  } catch {
    return 'Competitor landscape: unavailable right now.';
  }
}

async function buildWatchlistBlock(sellerId: string): Promise<string> {
  try {
    const watchlists = await listWatchlists(sellerId);
    const items = watchlists.flatMap((w) => w.items);
    if (items.length === 0) return 'Watchlist: empty.';

    const interesting = items.filter(
      (item) => item.inStock === false || (item.lastAlertedPrice != null && item.price != null && item.price !== item.lastAlertedPrice),
    );

    if (interesting.length === 0) return `Watchlist: ${items.length} items tracked, none with a notable price/stock change recently.`;

    const lines = interesting.slice(0, 8).map((item) => {
      const status = item.inStock === false ? 'now out of stock' : `price moved to ${item.price} (was ${item.lastAlertedPrice})`;
      return `- ${item.title}: ${status}`;
    });
    return `Watchlist (${items.length} tracked, notable changes):\n${lines.join('\n')}`;
  } catch {
    return 'Watchlist: unavailable right now.';
  }
}

// Cheap heuristic: does the seller's message plausibly name one of their own
// products? Reuses the same tokenize/jaccard matcher as product-matching.ts
// so "which product" means the same thing everywhere in the app. Only runs
// against the already-loaded product list (no extra query), and only
// triggers the expensive per-product competitor lookup below when it finds
// a plausible match - most questions are general and skip this entirely.
function findMentionedProduct(products: ProductRow[], message: string): ProductRow | null {
  if (!message.trim()) return null;
  const messageTokens = tokenize(message);
  if (messageTokens.size === 0) return null;

  let best: ProductRow | null = null;
  let bestScore = 0;
  for (const product of products) {
    if (product.sku && message.toLowerCase().includes(product.sku.toLowerCase())) return product;
    const score = jaccard(messageTokens, tokenize(product.title));
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }
  return bestScore >= MIN_CONFIDENCE ? best : null;
}

async function buildMentionedProductBlock(
  sellerId: string,
  categorySlug: string,
  currency: string,
  product: ProductRow,
): Promise<string> {
  try {
    const matches = await findCompetitorsForProduct(sellerId, product.id, categorySlug, currency, MAX_COMPETITOR_MATCHES_FOR_CHAT);
    if (matches.length === 0) return `Competitors for "${product.title}": none found in the current price bracket.`;

    const lines = matches.map((m) => `- ${m.matchedTitle} (${m.matchedPlatformName ?? 'unknown platform'}): ${m.matchedPrice ?? 'no price'} ${currency}`);
    return `Competitor listings for "${product.title}" (your price ${product.sellPrice ?? 'not set'} ${product.currency}):\n${lines.join('\n')}`;
  } catch {
    return `Competitors for "${product.title}": unavailable right now.`;
  }
}

export async function buildSellerContextBlock(seller: Seller, latestUserMessage: string): Promise<string> {
  const domain = await getPrimaryDomain(seller.id);
  const products = await loadProducts(seller.id);

  const sections: string[] = [buildProductsBlock(products, seller.reportingCurrency)];

  if (!domain) {
    sections.push('Market definition: no store category selected yet.');
  } else {
    const [marketScopeBlock, competitorLandscapeBlock, watchlistBlock] = await Promise.all([
      buildMarketScopeBlock(seller.id, domain.categorySlug),
      buildCompetitorLandscapeBlock(seller.id, domain.categorySlug, seller.reportingCurrency),
      buildWatchlistBlock(seller.id),
    ]);
    sections.push(marketScopeBlock, competitorLandscapeBlock, watchlistBlock);

    const mentioned = findMentionedProduct(products, latestUserMessage);
    if (mentioned) {
      sections.push(await buildMentionedProductBlock(seller.id, domain.categorySlug, seller.reportingCurrency, mentioned));
    }
  }

  // Assemble most-essential-first, dropping trailing sections once the cap
  // is hit rather than truncating mid-sentence - a shorter, complete block
  // beats a longer one cut off partway through a line.
  let assembled = '';
  for (const section of sections) {
    const next = assembled ? `${assembled}\n\n${section}` : section;
    if (next.length > CONTEXT_CHAR_CAP) break;
    assembled = next;
  }
  return assembled;
}
