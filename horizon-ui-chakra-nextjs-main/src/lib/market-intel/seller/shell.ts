'server-only';

import { listNotifications, type Notification } from '@/lib/notifications/list';
import { listSellerDomains, type Seller, type SellerDomainRow } from '@/lib/market-intel/seller/seller';

// Everything the app shell (sidebar + header) needs, resolved server-side in
// one pass.
//
// The three shell widgets each used to fetch for themselves after hydration:
// DomainSwitcher hit /api/domains, NotificationsMenu hit /api/notifications,
// PlanCard hit /api/profile. Because the shell wraps every authenticated
// route, that was three client round trips on *every* navigation - each one
// re-running getCurrentSeller() and paying its own auth.getUser() call to
// Supabase (see seller.ts for why that is a real network hop, not a local
// decode). The per-page fetches were converted to Server Components first;
// this is the global one that survived that pass, and it is the one that ran
// everywhere rather than on one route.
//
// planTier needs no query at all: it is already on the Seller the layout has
// resolved. PlanCard's /api/profile call was fetching an object to read one
// field the caller was already holding.
//
// Fails soft, deliberately. A broken notifications query should degrade the
// bell to empty, not take down every page in the app behind an error
// boundary - the shell is chrome, and the page inside it is the thing the
// user came for. Both underlying functions already return [] on a query
// error rather than throwing; the catch here covers the unexpected rest.

export type ShellData = {
  domains: SellerDomainRow[];
  notifications: Notification[];
  planTier: string;
};

export async function getShellData(seller: Seller): Promise<ShellData> {
  const [domains, notifications] = await Promise.all([
    listSellerDomains(seller.id).catch((): SellerDomainRow[] => []),
    listNotifications(seller.id).catch((): Notification[] => []),
  ]);

  return { domains, notifications, planTier: seller.planTier };
}
