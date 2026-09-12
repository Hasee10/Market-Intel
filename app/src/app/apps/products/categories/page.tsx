import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerCategories } from '@/lib/market-intel/seller/categories';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import CategoriesView from './CategoriesView';

// Server Component - same move as apps/products/page.tsx, see its header
// comment for the full rationale. This page had exactly one client fetch to
// begin with (no second /api/profile round trip like Products had), so the
// win here is smaller in absolute terms but the same in kind: one auth
// round trip instead of one per page load, and content that's already
// there on first paint instead of a skeleton-then-pop-in.
export default async function CategoriesPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading categories" message="Not authenticated" />;
  }

  try {
    const categories = await getSellerCategories(seller.id);
    return <CategoriesView categories={categories} />;
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading categories"
        message={err instanceof Error ? err.message : 'Failed to fetch categories'}
      />
    );
  }
}
