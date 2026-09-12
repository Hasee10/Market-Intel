import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerProfile } from '@/lib/market-intel/seller/settings';
import {
  getCurrentSeller,
  listCategories,
  listSellerDomains,
} from '@/lib/market-intel/seller/seller';
import { getReferralStats, type ReferralStats } from '@/lib/market-intel/seller/referrals';

import SettingsView from './SettingsView';

// Server Component - same move as apps/orders/page.tsx. The initial
// useProfile() GET on load is now fetched server-side; the PUT save
// mutation stays a plain client fetch in SettingsView (a real mutation
// triggered by user action, not page load).
//
// DomainsManager and ReferralCard were the last two components on this page
// still fetching for themselves after hydration (/api/domains and
// /api/referrals), so loading Settings meant three client round trips where
// one server pass does. Their data joins the same fetch here.
//
// Domains/referrals fail soft rather than taking the page down: a seller who
// cannot load their referral stats should still be able to change their
// reporting currency. listSellerDomains is cache()d, so the copy the shell
// already resolved this request is reused rather than re-queried.
export default async function SettingsPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading settings" message="Not authenticated" />;
  }

  try {
    const [profile, domains, categories, referral] = await Promise.all([
      getSellerProfile(seller),
      listSellerDomains(seller.id),
      listCategories(),
      getReferralStats(seller.id).catch((): ReferralStats | null => null),
    ]);

    return (
      <SettingsView
        profile={profile}
        domains={domains}
        categories={categories}
        referral={referral}
      />
    );
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading settings"
        message={err instanceof Error ? err.message : 'Failed to fetch settings'}
      />
    );
  }
}
