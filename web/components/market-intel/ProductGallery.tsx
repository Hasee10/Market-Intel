'use client';

import Image from 'next/image';
import { useState } from 'react';

export function ProductGallery({ title, urls }: { title: string; urls: string[] }) {
  const [active, setActive] = useState(0);

  if (!urls.length) return null;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Image
          alt={title}
          className="object-contain"
          fill
          sizes="(min-width: 768px) 320px, 100vw"
          src={urls[active]}
          unoptimized
        />
      </div>
      {urls.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {urls.map((url, i) => (
            <button
              aria-label={`View image ${i + 1}`}
              className={`relative aspect-square overflow-hidden rounded-md border transition-colors ${
                i === active
                  ? 'border-zinc-900 dark:border-zinc-50'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
              }`}
              key={url}
              onClick={() => setActive(i)}
              type="button"
            >
              <Image alt="" className="object-contain" fill sizes="80px" src={url} unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
