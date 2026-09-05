import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireOnboardedSeller } from '@/lib/market-intel/seller/seller';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough.
// requireOnboardedSeller() also sends a seller with no category picked yet
// to /onboarding first, same as dashboard/layout.tsx.
export default async function AppsLayout({ children }: { children: ReactNode }) {
  await requireOnboardedSeller();
  return <AdminShell>{children}</AdminShell>;
}
