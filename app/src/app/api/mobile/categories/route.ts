import { listSellerDomains } from '@/lib/market-intel/seller/seller';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The categories the seller actually sells in, for the switcher sheet.
//
// Deliberately NOT the full taxonomy. listCategories() returns all twelve
// categories the platform knows about; offering those in a switcher would
// let a seller select a market they have no products in and then wonder why
// every screen behind it is empty. The switcher is for moving between
// markets the seller is already tracked in, which is exactly what
// seller_domains holds.
//
// listSellerDomains already returns { categorySlug, categoryName, isPrimary }
// ordered primary-first, so there is nothing to compute here - only
// categoryId is dropped, because the client has no use for an id it can't
// pass anywhere. Every endpoint that takes a category takes the slug.

export async function GET(request: Request) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  let domains;
  try {
    domains = await listSellerDomains(seller.id);
  } catch {
    return mobileError('Could not load categories', 500);
  }

  return mobileOk({
    categories: domains.map((d) => ({
      categorySlug: d.categorySlug,
      categoryName: d.categoryName,
      isPrimary: d.isPrimary,
    })),
  });
}
