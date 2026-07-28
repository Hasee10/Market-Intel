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
      <CategoryPicker categories={categories} />
    </div>
  );
}
