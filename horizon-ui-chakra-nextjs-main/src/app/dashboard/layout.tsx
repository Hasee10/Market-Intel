'use client';

import { ReactNode } from 'react';
import AdminShell from '@/components/marketintel/AdminShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
