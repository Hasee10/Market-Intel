import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';
import { requireOnboardedSeller } from '@/lib/market-intel/seller';

// Real server-side auth guard - see requireSeller()'s comment for why
// middleware.ts's cookie-presence check alone isn't enough. Server
// Component (no 'use client') so the redirect happens before anything
// renders; AdminShell itself is still a Client Component, which is fine to
// render directly from here. requireOnboardedSeller() (not requireSeller())
// also sends a seller with no category picked yet to /onboarding first.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireOnboardedSeller();
  return <AdminShell>{children}</AdminShell>;
}
