import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireSeller } from '@/lib/market-intel/seller/seller';
import { getShellData } from '@/lib/market-intel/seller/shell';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough. onboarding/
// page.tsx already had its own redirect('/auth/signin') for this case, but
// that only protected this one page - Market/Watchlist/etc. under
// dashboard/apps had no equivalent check at all until now.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const seller = await requireSeller();
  const shell = await getShellData(seller);
  return <AdminShell shell={shell}>{children}</AdminShell>;
}
