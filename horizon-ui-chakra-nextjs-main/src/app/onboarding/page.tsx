import Image from 'next/image';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/marketintel/PageHeader';
import { getCurrentSeller, getPrimaryDomain, listCategories } from '@/lib/market-intel/seller';
import { PATH_DASHBOARD } from '@/lib/paths';

import { CategoryPicker } from './CategoryPicker';

export default async function OnboardingPage() {
  const seller = await getCurrentSeller();

  if (!seller) {
    redirect('/auth/signin');
  }

  const existingDomain = await getPrimaryDomain(seller.id);
  if (existingDomain) {
    redirect(PATH_DASHBOARD.market);
  }

  const categories = await listCategories();

  return (
    <div>
      <PageHeader title="Welcome - one quick step" />
      {/* Plain elements, not Chakra, since this stays an async Server
          Component (real data fetching above) - Chakra components need a
          'use client' boundary under this Next/RSC setup, same issue that
          broke the landing page earlier. CategoryPicker/PageHeader are
          fine because they're their own 'use client' components. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 360px' }}>
          <CategoryPicker categories={categories} />
        </div>
        <div style={{ flex: '1 1 320px', maxWidth: '420px', display: 'flex', justifyContent: 'center' }}>
          {/* next/image works fine in a Server Component (unlike Chakra, per
              the comment above), and this 585KB PNG is the single largest
              asset in the app - now resized and re-encoded rather than
              shipped whole. */}
          <Image
            src="/assets/ryvl-dashboard-illustration.png"
            alt="Preview of the Ryvl seller dashboard"
            width={1200}
            height={800}
            sizes="(max-width: 768px) 100vw, 420px"
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}
