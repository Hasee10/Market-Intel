import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireSeller } from '@/lib/market-intel/seller/seller';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough. onboarding/
// page.tsx already had its own redirect('/auth/signin') for this case, but
// that only protected this one page - Market/Watchlist/etc. under
// dashboard/apps had no equivalent check at all until now.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireSeller();
  return <AdminShell>{children}</AdminShell>;
}
