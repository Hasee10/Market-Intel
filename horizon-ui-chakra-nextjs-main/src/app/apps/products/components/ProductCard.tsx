'use client';

import { MdEdit, MdStorefront } from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Table';
import { ProductThumb } from '@/components/ui/ProductThumb';
import { IProduct } from '@/types/products';

type ProductCardProps = {
  data: IProduct;
  onEdit?: (product: IProduct) => void;
  onViewCompetitors?: (product: IProduct) => void;
};

// Was hardcoded to 'USD' regardless of the product's actual currency -
// every non-USD product showed a misleading $ sign on the wrong amount.
const formatCurrency = (amount: number | null, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount ?? 0,
  );

// Same threshold Overview's "Low Stock Products" stat uses
// (api/ecommerce/stats/route.ts) - keeping this in sync means a product
// flagged low here is flagged low there too, not two different definitions
// of "low" on the same dashboard.
const LOW_STOCK_THRESHOLD = 10;

// Mirrors MIN_MARGIN_PCT in lib/market-intel/pricing-recommendation.ts (not
// importable here - that file is server-only). Same 15% floor the pricing
// recommendation engine already treats as the line between healthy and thin.
const HEALTHY_MARGIN_PCT = 0.15;

export function ProductCard({ data, onEdit, onViewCompetitors }: ProductCardProps) {
  const isLowStock = data.isActive && (data.stockQty ?? 0) < LOW_STOCK_THRESHOLD;

  const marginPct =
    data.costPrice && data.costPrice > 0 && data.sellPrice
      ? ((data.sellPrice - data.costPrice) / data.sellPrice) * 100
      : null;

  const marginClass =
    marginPct === null
      ? ''
      : marginPct >= HEALTHY_MARGIN_PCT * 100
        ? 'text-success-600 dark:text-success-500'
        : marginPct < 0
          ? 'text-error-600 dark:text-error-500'
          : 'text-orange-500';

  return (
    <Card className="flex h-full flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex items-start gap-3">
        <ProductThumb categoryName={data.categoryName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900 dark:text-white">{data.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Pill tone="brand">{data.categoryName || 'Uncategorized'}</Pill>
            {data.sku && (
              <span className="text-xs text-gray-500 dark:text-gray-400">SKU {data.sku}</span>
            )}
          </div>
        </div>
        <Pill tone={data.isActive ? 'success' : 'neutral'}>
          {data.isActive ? 'Active' : 'Inactive'}
        </Pill>
      </div>

      <div className="mb-4 flex justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sell price</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
            {formatCurrency(data.sellPrice, data.currency)}
          </p>
          {marginPct !== null && (
            <p className={`text-xs font-semibold tabular-nums ${marginClass}`}>
              {marginPct.toFixed(0)}% margin
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Stock</p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              isLowStock ? 'text-orange-600 dark:text-orange-500' : 'text-gray-900 dark:text-white'
            }`}
          >
            {data.stockQty ?? 0}
            {isLowStock && ' ⚠'}
          </p>
        </div>
      </div>

      <div className="mt-auto flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<MdStorefront className="size-4" />}
          onClick={() => onViewCompetitors?.(data)}
        >
          Competitors
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<MdEdit className="size-4" />}
          onClick={() => onEdit?.(data)}
        >
          Edit
        </Button>
      </div>
    </Card>
  );
}

export default ProductCard;
