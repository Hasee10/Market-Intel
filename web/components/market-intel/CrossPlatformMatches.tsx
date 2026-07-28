import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { MarketProduct } from '@/lib/market-intel/products';

function formatPrice(currency: string, value: number | null): string {
  if (value === null) return '—';
  return `${currency} ${value.toLocaleString()}`;
}

export function CrossPlatformMatches({ matches }: { matches: MarketProduct[] }) {
  if (!matches.length) return null;

  return (
    <div>
      <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">Also available on</h2>
      <div className="mt-3 space-y-2">
        {matches.map((m) => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            key={m.id}
          >
            <Link className="min-w-0 flex-1" href={`/intel/products/${m.id}`}>
              <p className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">{m.title}</p>
              <p className="mt-0.5 text-xs capitalize text-zinc-500 dark:text-zinc-400">{m.platformSlug}</p>
            </Link>
            <span className="whitespace-nowrap text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {formatPrice(m.currency, m.price)}
            </span>
            <a
              aria-label="View original listing"
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              href={m.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
