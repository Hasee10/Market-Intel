import { ExternalLink, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CrossPlatformMatches } from '@/components/market-intel/CrossPlatformMatches';
import { PriceHistoryChart } from '@/components/market-intel/PriceHistoryChart';
import { ProductGallery } from '@/components/market-intel/ProductGallery';
import { ProductWatchButton } from '@/components/market-intel/ProductWatchButton';
import { SimilarProductsRail } from '@/components/market-intel/SimilarProductsRail';
import {
  getCrossPlatformMatches,
  getPriceHistory,
  getProductById,
  getSimilarProducts,
} from '@/lib/market-intel/products';
import { listWatchlistProductIds } from '@/lib/market-intel/watchlist';
import config from '@/config';

export const dynamic = 'force-dynamic';

function formatPrice(currency: string, value: number | null): string {
  if (value === null) return '—';
  return `${currency} ${value.toLocaleString()}`;
}

function discountPercent(price: number | null, compareAtPrice: number | null): number | null {
  if (!price || !compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return {
    title: product ? `${product.title} | Market Intel | ${config.title}` : `Market Intel | ${config.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function MarketIntelProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/intel/sign-in?callbackUrl=/intel/dashboard');
  if (session.user.role !== 'market_analyst') redirect('/');

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const [priceHistory, similarProducts, crossPlatformMatches, watchedIds] = await Promise.all([
    getPriceHistory(product.id),
    getSimilarProducts(product),
    getCrossPlatformMatches(product),
    listWatchlistProductIds(session.user.id),
  ]);

  const discount = discountPercent(product.price, product.compareAtPrice);
  const galleryUrls = product.galleryUrls?.length ? product.galleryUrls : product.imageUrl ? [product.imageUrl] : [];

  return (
    <main className="min-h-[60vh] bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <Link
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            href="/intel/dashboard"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-4 flex flex-col gap-6 md:flex-row">
            {galleryUrls.length > 0 && (
              <div className="w-full md:w-80 md:shrink-0">
                <ProductGallery title={product.title} urls={galleryUrls} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-bold text-2xl text-zinc-900 dark:text-zinc-50">{product.title}</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="capitalize">{product.platformSlug}</span>
                    {product.brand && <> · {product.brand}</>}
                    {product.categorySlug && <> · {product.categorySlug}</>}
                  </p>
                </div>
                <ProductWatchButton initialWatched={watchedIds.includes(product.id)} productId={product.id} />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="font-bold text-3xl text-zinc-900 dark:text-zinc-50">
                  {formatPrice(product.currency, product.price)}
                </span>
                {product.compareAtPrice && product.compareAtPrice !== product.price && (
                  <span className="text-lg text-zinc-400 line-through">
                    {formatPrice(product.currency, product.compareAtPrice)}
                  </span>
                )}
                {discount && (
                  <span className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                    -{discount}%
                  </span>
                )}
                {product.inStock !== null &&
                  (product.inStock ? (
                    <span className="text-sm text-green-700 dark:text-green-400">In stock</span>
                  ) : (
                    <span className="text-sm text-red-600 dark:text-red-400">Out of stock</span>
                  ))}
                {product.rating !== null && (
                  <span className="inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {product.rating.toFixed(1)}
                    {product.ratingCount !== null && ` (${product.ratingCount})`}
                  </span>
                )}
              </div>

              <a
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700"
                href={product.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                View original listing
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">Price history</h2>
            <div className="mt-3">
              <PriceHistoryChart currency={product.currency} points={priceHistory} />
            </div>
          </div>

          <div className="mt-10">
            <CrossPlatformMatches matches={crossPlatformMatches} />
          </div>

          <div className="mt-10">
            <SimilarProductsRail products={similarProducts} />
          </div>
        </div>
      </div>
    </main>
  );
}
