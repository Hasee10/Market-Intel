import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireOnboardedSeller } from '@/lib/market-intel/seller/seller';
import { getShellData } from '@/lib/market-intel/seller/shell';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough.
// requireOnboardedSeller() also sends a seller with no category picked yet
// to /onboarding first, same as dashboard/layout.tsx.
//
// The shell's own data is resolved here too rather than by the three widgets
// fetching for themselves after hydration - see shell.ts for why that
// mattered on every single navigation.
export default async function AppsLayout({ children }: { children: ReactNode }) {
  const seller = await requireOnboardedSeller();
  const shell = await getShellData(seller);
  return <AdminShell shell={shell}>{children}</AdminShell>;
}
