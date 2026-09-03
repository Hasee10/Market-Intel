import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { hasFeature } from '@/lib/market-intel/core/entitlements';
import { getCurrentSeller, resolveSelectedDomain } from '@/lib/market-intel/seller/seller';
import { listWatchlists } from '@/lib/market-intel/seller/watchlists';
import { listNotifications } from '@/lib/notifications/list';

import WatchlistView from './WatchlistView';

// Server Component: data-fetching only, same split as dashboard/market -
// Chakra/Mantine components need a client boundary under this Next/Turbopack
// stack (see dashboard/market/page.tsx's comment for the fuller story).
async function Page({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { domain: domainSlug } = await searchParams;
  const seller = await getCurrentSeller();
  const hasAccess = hasFeature(seller?.planTier ?? 'free', 'watchlists');
  // The domain scopes the competitor-product search used to add items, so a
  // seller switching to another tracked category searches that category's
  // listings rather than their primary one's.
  const domain = seller && hasAccess ? await resolveSelectedDomain(seller.id, domainSlug) : null;
  const watchlists = seller && hasAccess ? await listWatchlists(seller.id) : [];
  const notifications = seller && hasAccess ? await listNotifications(seller.id, 20) : [];

  return (
    <>
      <title>Watchlist | Ryvl</title>
      <meta
        name="description"
        content="Track competitor products and get alerted when their price or stock changes."
      />
      {hasAccess ? (
        <WatchlistView
          categorySlug={domain?.categorySlug ?? null}
          reportingCurrency={seller?.reportingCurrency ?? 'PKR'}
          watchlists={watchlists}
          notifications={notifications}
        />
      ) : (
        <>
          <PageHeader title="Watchlist" />
          <UpgradeGate hasAccess={false} requiredPlanLabel="Paid" featureName="Competitor watchlists & price alerts">
            <div />
          </UpgradeGate>
        </>
      )}
    </>
  );
}

export default Page;
