'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

export function ProductWatchButton({ productId, initialWatched }: { productId: string; initialWatched: boolean }) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !watched;
    setPending(true);
    setWatched(next);

    try {
      const res = next
        ? await fetch('/api/market-intel/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          })
        : await fetch(`/api/market-intel/watchlist?productId=${encodeURIComponent(productId)}`, {
            method: 'DELETE',
          });
      if (!res.ok) throw new Error('Failed to update watchlist');
    } catch {
      setWatched(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={watched}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-amber-500 hover:text-amber-500 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400"
      disabled={pending}
      onClick={toggle}
      type="button"
    >
      <Star aria-hidden="true" className={`h-4 w-4 ${watched ? 'fill-amber-500 text-amber-500' : ''}`} />
      {watched ? 'Watching' : 'Watch'}
    </button>
  );
}
