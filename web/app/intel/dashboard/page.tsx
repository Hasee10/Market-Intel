import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { MarketProductsTable } from '@/components/market-intel/MarketProductsTable';
import { getMarketAccountById } from '@/lib/auth/market-accounts';
import { listMarketProducts } from '@/lib/market-intel/products';
import { listWatchlistProductIds } from '@/lib/market-intel/watchlist';
import config from '@/config';

export const metadata: Metadata = {
  title: `Market Intel Dashboard | ${config.title}`,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MarketIntelDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/intel/sign-in?callbackUrl=/intel/dashboard');
  if (session.user.role !== 'market_analyst') redirect('/');

  const [account, products, watchedIds] = await Promise.all([
    getMarketAccountById(session.user.id),
    listMarketProducts(),
    listWatchlistProductIds(session.user.id),
  ]);

  return (
    <main className="min-h-[60vh] bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-bold text-2xl text-zinc-900 dark:text-zinc-50">
                {account?.companyName || 'Market Intel'}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{session.user.email}</p>
            </div>
            <SignOutButton />
          </div>

          <div className="mt-8">
            <MarketProductsTable initial={products} initialWatchedIds={watchedIds} />
          </div>
        </div>
      </div>
    </main>
  );
}
