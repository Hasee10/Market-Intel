import type { PricePoint } from '@/lib/market-intel/products';

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = 24;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PriceHistoryChart({ currency, points }: { currency: string; points: PricePoint[] }) {
  const withPrice = points.filter((p): p is PricePoint & { price: number } => p.price !== null);

  if (withPrice.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Not enough price history yet - check back after a few more scrapes.
      </div>
    );
  }

  const prices = withPrice.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;

  const coords = withPrice.map((p, i) => {
    const x = PADDING + (i / (withPrice.length - 1)) * innerWidth;
    const y = PADDING + innerHeight - ((p.price - min) / range) * innerHeight;
    return { x, y, point: p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${HEIGHT - PADDING} L${coords[0].x.toFixed(1)},${HEIGHT - PADDING} Z`;

  const first = withPrice[0];
  const last = withPrice[withPrice.length - 1];

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Low {currency} {min.toLocaleString()}
        </span>
        <span>
          High {currency} {max.toLocaleString()}
        </span>
      </div>
      <svg className="w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Price history over time">
        <path d={areaPath} className="fill-zinc-900/5 dark:fill-zinc-50/10" />
        <path d={linePath} className="fill-none stroke-zinc-900 dark:stroke-zinc-50" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} className="fill-zinc-900 dark:fill-zinc-50" cx={c.x} cy={c.y} r={2.5} />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{formatDate(first.recordedAt)}</span>
        <span>{formatDate(last.recordedAt)}</span>
      </div>
    </div>
  );
}
