'use client';

// Thumbnail for product rows and cards.
//
// seller_products has no image column (see migration 011), so there is no
// photo to show and inventing one would be worse than none. Instead this
// derives a stable tile from the product's category: the same icon and
// accent colour the Categories page already uses (categoryVisuals.ts), so a
// "Sports & Outdoors" product looks the same everywhere in the app.
//
// Migration 049 added seller_products.image_url, so `src` now carries a real
// seller-supplied image when one exists. The category tile remains the
// fallback for products without one, and for images whose URL has rotted.

import { useState } from 'react';
import { MdImageNotSupported } from 'react-icons/md';

import { CATEGORY_VISUALS } from '@/app/apps/products/categories/components/categoryVisuals';

// The table gives us the display name ("Sports & Outdoors"), not the slug,
// so normalise back to the slug form CATEGORY_VISUALS is keyed on.
function slugify(categoryName: string): string {
  return categoryName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ProductThumb({
  src,
  alt,
  categoryName,
  size = 'md',
}: {
  /** Seller-supplied image URL. Falls back to the category tile when absent. */
  src?: string | null;
  alt?: string;
  categoryName: string | null;
  /** md for table rows, lg for the grid cards. */
  size?: 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);

  const visual = categoryName ? CATEGORY_VISUALS[slugify(categoryName)] : undefined;
  const Icon = visual?.icon ?? MdImageNotSupported;
  const accent = visual?.color ?? '#98A2B3';
  const box = size === 'lg' ? 'size-14 rounded-xl' : 'size-10 rounded-lg';
  const glyph = size === 'lg' ? 'size-7' : 'size-5';

  // A dead URL degrades to the tile rather than a broken-image icon - these
  // point at arbitrary third-party hosts, so some will rot.
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary
      // seller-supplied third-party host; next/image can't optimise it and
      // would need every domain whitelisted in next.config.js.
      <img
        src={src}
        alt={alt ?? ''}
        onError={() => setFailed(true)}
        loading="lazy"
        className={`shrink-0 border border-gray-200 object-cover dark:border-gray-700 ${box}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      // Colour comes from the category map at runtime, so it has to be an
      // inline style - Tailwind cannot generate a class for a value it never
      // sees in the source.
      style={{ backgroundColor: `${accent}1A`, color: accent }}
      className={`flex shrink-0 items-center justify-center ${box}`}
    >
      <Icon className={glyph} />
    </span>
  );
}

export default ProductThumb;
