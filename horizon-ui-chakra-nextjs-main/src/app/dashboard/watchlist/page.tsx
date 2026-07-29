import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';
import { listWatchlists } from '@/lib/market-intel/watchlists';
import { listNotifications } from '@/lib/notifications/list';

import WatchlistView from './WatchlistView';

// Server Component: data-fetching only, same split as dashboard/market -
// Chakra/Mantine components need a client boundary under this Next/Turbopack
// stack (see dashboard/market/page.tsx's comment for the fuller story).
async function Page() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;
  const watchlists = seller ? await listWatchlists(seller.id) : [];
  const notifications = seller ? await listNotifications(seller.id, 20) : [];

  return (
    <>
      <title>Watchlist | Market Intel</title>
      <meta
        name="description"
        content="Track competitor products and get alerted when their price or stock changes."
      />
      <WatchlistView
        categorySlug={domain?.categorySlug ?? null}
        watchlists={watchlists}
        notifications={notifications}
      />
    </>
  );
}

export default Page;
