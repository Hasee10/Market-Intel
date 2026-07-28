import Link from 'next/link';
import type { MarketProduct } from '@/lib/market-intel/products';

function formatPrice(currency: string, value: number | null): string {
  if (value === null) return '—';
  return `${currency} ${value.toLocaleString()}`;
}

export function SimilarProductsRail({ products }: { products: MarketProduct[] }) {
  if (!products.length) return null;

  return (
    <div>
      <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">Similar items</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {products.map((p) => (
          <Link
            className="rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            href={`/intel/products/${p.id}`}
            key={p.id}
          >
            <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{p.title}</p>
            <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{p.platformSlug}</p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {formatPrice(p.currency, p.price)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
