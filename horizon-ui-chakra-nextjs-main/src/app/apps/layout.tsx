import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireSeller } from '@/lib/market-intel/seller';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough.
export default async function AppsLayout({ children }: { children: ReactNode }) {
  await requireSeller();
  return <AdminShell>{children}</AdminShell>;
}
