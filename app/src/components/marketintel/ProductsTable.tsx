'use client';

import { MdEdit, MdStorefront } from 'react-icons/md';

import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { ProductThumb } from '@/components/ui/ProductThumb';
import type { IProduct } from '@/types/products';

type ProductsTableProps = {
  data: IProduct[];
  loading?: boolean;
  onEdit?: (product: IProduct) => void;
  onViewCompetitors?: (product: IProduct) => void;
};

const formatCurrency = (amount: number | null, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount ?? 0,
  );

// Same threshold Overview's "Low Stock Products" stat uses
// (api/ecommerce/stats/route.ts), so a product flagged low here is flagged
// low there too instead of two different definitions of "low" on the same
// dashboard.
const LOW_STOCK_THRESHOLD = 10;

const rowAction =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800';

// Demand index (lib/market-intel/market/demand-index.ts) - a percentile
// within the product's category, not a count. Shown as a column only when
// at least one row carries it: a seller with no confirmed matches, or a
// deployment where migration 061 isn't applied yet, sees the table exactly
// as it was. A product with no index gets a dash, never a zero - zero is a
// real (bad) score, and "no matched listing to measure" is not that.
function demandTone(index: number): string {
  if (index >= 70) return 'success';
  if (index >= 40) return 'warning';
  return 'neutral';
}

function demandTitle(d: NonNullable<IProduct['demandIndex']>): string {
  const parts = [
    d.soldPct != null ? `Sold: top ${Math.round((1 - d.soldPct) * 100)}% (${d.soldCount ?? '?'} sold)` : 'Sold: not reported on this platform',
    d.reviewsPct != null ? `Reviews: top ${Math.round((1 - d.reviewsPct) * 100)}% (${d.ratingCount ?? '?'} reviews)` : 'Reviews: not reported',
    d.rankPct != null ? `Page position: top ${Math.round((1 - d.rankPct) * 100)}% (#${d.latestRank})` : 'Page position: not observed yet',
  ];
  return `${parts.join(' · ')} · among ${d.categoryListings.toLocaleString()} listings in the category`;
}

export function ProductsTable({ data, loading, onEdit, onViewCompetitors }: ProductsTableProps) {
  const showDemand = data.some((p) => p.demandIndex != null);
  return (
    <Table minWidth={760}>
      <THead>
        <TH>Product</TH>
        <TH>SKU</TH>
        <TH>Category</TH>
        <TH numeric>Sell price</TH>
        <TH numeric>Stock</TH>
        {showDemand && (
          <TH numeric title="0-100: where this product's matched listing sits in its category on sold count, reviews and page position. Hover a value for the breakdown.">
            Demand
          </TH>
        )}
        <TH>Status</TH>
        <TH />
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <TR key={`row-loading-${i}`}>
                <TD colSpan={showDemand ? 8 : 7}>
                  <span className="block h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </TD>
              </TR>
            ))
          : data.map((product) => {
              const isLowStock = product.isActive && (product.stockQty ?? 0) < LOW_STOCK_THRESHOLD;
              return (
                <TR key={product.id}>
                  <TD strong>
                    {/* Thumbnail + title in one cell, matching TailAdmin's
                        product rows. SKU moves under the title on narrow
                        screens via its own column, so nothing is lost. */}
                    <span className="flex items-center gap-3">
                      <ProductThumb src={product.imageUrl} alt={product.title} categoryName={product.categoryName} />
                      <span className="min-w-0 truncate">{product.title}</span>
                    </span>
                  </TD>
                  <TD>{product.sku || 'N/A'}</TD>
                  <TD>
                    <Pill tone="brand">{product.categoryName || 'Uncategorized'}</Pill>
                  </TD>
                  <TD numeric>{formatCurrency(product.sellPrice, product.currency)}</TD>
                  <TD
                    numeric
                    className={isLowStock ? '!font-bold !text-orange-600 dark:!text-orange-500' : ''}
                  >
                    {product.stockQty ?? 0}
                    {isLowStock && ' ⚠'}
                  </TD>
                  {showDemand && (
                    <TD numeric>
                      {product.demandIndex ? (
                        <span title={demandTitle(product.demandIndex)}>
                          <Pill tone={demandTone(product.demandIndex.index)}>{product.demandIndex.index}</Pill>
                        </span>
                      ) : (
                        <span className="text-gray-400" title="No matched listing in the market to measure against">—</span>
                      )}
                    </TD>
                  )}
                  <TD>
                    <Pill tone={product.isActive ? 'success' : 'neutral'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Pill>
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onEdit?.(product)} className={rowAction}>
                        <MdEdit className="size-4" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewCompetitors?.(product)}
                        className={rowAction}
                      >
                        <MdStorefront className="size-4" aria-hidden="true" />
                        Competitors
                      </button>
                    </div>
                  </TD>
                </TR>
              );
            })}
      </TBody>
    </Table>
  );
}

export default ProductsTable;
