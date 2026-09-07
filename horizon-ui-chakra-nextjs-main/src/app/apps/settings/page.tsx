import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerProfile } from '@/lib/market-intel/seller/settings';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import SettingsView from './SettingsView';

// Server Component - same move as apps/orders/page.tsx. The initial
// useProfile() GET on load is now fetched server-side; the PUT save
// mutation stays a plain client fetch in SettingsView (a real mutation
// triggered by user action, not page load).
export default async function SettingsPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading settings" message="Not authenticated" />;
  }

  try {
    const profile = await getSellerProfile(seller);
    return <SettingsView profile={profile} />;
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading settings"
        message={err instanceof Error ? err.message : 'Failed to fetch settings'}
      />
    );
  }
}
