import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';
import { listWatchlists } from '@/lib/market-intel/watchlists';
import { listNotifications } from '@/lib/notifications/list';

import WatchlistView from './WatchlistView';

// Server Component: data-fetching only, same split as dashboard/market -
// Chakra/Mantine components need a client boundary under this Next/Turbopack
// stack (see dashboard/market/page.tsx's comment for the fuller story).
async function Page() {
  const seller = await getCurrentSeller();
  const hasAccess = hasFeature(seller?.planTier ?? 'free', 'watchlists');
  const domain = seller && hasAccess ? await getPrimaryDomain(seller.id) : null;
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
