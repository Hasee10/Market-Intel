'use server';

import { revalidatePath } from 'next/cache';

import { saveMarketDefinition, type MarketDefinitionInput } from '@/lib/market-intel/market/market-definition';
import { requireSeller } from '@/lib/market-intel/seller/seller';
import { PATH_DASHBOARD } from '@/lib/paths';

// A flat shape rather than a discriminated union: server action return types
// go through Next's serialization boundary, where the union does not narrow
// reliably on the client.
export type SaveResult = { ok: boolean; error?: string };

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The seller id comes from requireSeller(), never from the client payload -
// otherwise this would be a write-any-seller's-definition endpoint. RLS on
// seller_market_definitions is the second line of defence, not the first.
export async function saveMarketDefinitionAction(input: {
  sellerCategorySlug: string;
  includedSegments: string[];
  excludedPlatformIds: string[];
  priceMin: string | number | null;
  priceMax: string | number | null;
  priceCurrency: string;
  brands: string[];
  cities: string[];
}): Promise<SaveResult> {
  const seller = await requireSeller();

  const priceMin = parseOptionalNumber(input.priceMin);
  const priceMax = parseOptionalNumber(input.priceMax);

  // Mirrors the CHECK constraints in migration 020 so the seller gets a
  // sentence instead of a Postgres error string (leaks.md finding #12).
  if (priceMin != null && priceMin < 0) {
    return { ok: false, error: 'The minimum price cannot be negative.' };
  }
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, error: 'The minimum price must be lower than the maximum.' };
  }

  const payload: MarketDefinitionInput = {
    sellerCategorySlug: input.sellerCategorySlug,
    includedSegments: input.includedSegments,
    excludedPlatformIds: input.excludedPlatformIds,
    priceMin,
    priceMax,
    priceCurrency: input.priceCurrency,
    brands: input.brands,
    cities: input.cities,
  };

  try {
    await saveMarketDefinition(seller.id, payload);
  } catch {
    return { ok: false, error: 'Could not save your market definition. Please try again.' };
  }

  // Every analysis surface is computed against this, so they all go stale the
  // moment it changes.
  revalidatePath(PATH_DASHBOARD.market);
  revalidatePath(PATH_DASHBOARD.marketDefinition);
  revalidatePath(PATH_DASHBOARD.overview);

  return { ok: true };
}
