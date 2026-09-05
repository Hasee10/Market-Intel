import { NextRequest, NextResponse } from 'next/server';

import { GroqNotConfiguredError, suggestCategoriesBatch } from '@/lib/ai/suggest-category';
import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCountryProductConfig } from '@/lib/market-intel/core/countries';
import { autoAssignDomainsForCategories, getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_CURRENCIES } from '@/types/products';

// The extra Groq round-trips for auto-categorization can push a large
// import past a short serverless default.
export const maxDuration = 60;

// Bounds how many rows in one import get auto-categorized, so a 5000-row
// CSV (MAX_IMPORT_ROWS) can't turn into thousands of sequential Groq calls.
// Rows beyond this stay uncategorized (category_id: null), same as today,
// and the count is surfaced in the response rather than dropped silently.
const AUTO_CATEGORIZE_MAX_ROWS = 1000;
const CATEGORIZE_BATCH_SIZE = 25;
const CATEGORIZE_CONCURRENCY = 4;

type ImportRow = {
  sku?: string;
  title?: string;
  categoryId?: string;
  costPrice?: number;
  sellPrice?: number;
  stockQty?: number;
  isActive?: boolean;
  imageUrl?: string;
  currency?: string;
};

const VALID_CURRENCY_CODES = new Set<string>(SUPPORTED_CURRENCIES.map((c) => c.code));

// A stable, deterministic key for rows with no SKU - not shown to the
// seller (see import_key's comment in migration 027), only used so
// re-uploading the same CSV updates the same row instead of creating a
// duplicate every time. Two genuinely different products sharing an exact
// title collapse to one row without a SKU to tell them apart - an honest
// limitation given there is no other stable identity to key on, not a bug.
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// Upserts keyed on (seller_id, sku) when a row has one - the unique index
// seller_products already has (011_create_seller_platform_tables.sql) - or
// (seller_id, import_key) when it doesn't and the seller's country doesn't
// require one (countries.ts, migration 027). A row always needs a title;
// that's the one field no market can reasonably do without.
export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [`Too many rows: ${rows.length} (max ${MAX_IMPORT_ROWS} per import)`],
        message: `Split the file into batches of ${MAX_IMPORT_ROWS} rows or fewer.`,
      },
      { status: 413 },
    );
  }

  const { skuRequired } = getCountryProductConfig(seller.country);
  const defaultCurrency = VALID_CURRENCY_CODES.has(seller.reportingCurrency) ? seller.reportingCurrency : 'PKR';

  const withSku: ImportRow[] = [];
  const withoutSku: ImportRow[] = [];
  let skippedMissingTitle = 0;
  let skippedMissingSku = 0;

  for (const r of rows) {
    if (!r.title) {
      skippedMissingTitle += 1;
      continue;
    }
    if (r.sku) {
      withSku.push(r);
    } else if (skuRequired) {
      skippedMissingSku += 1;
    } else {
      withoutSku.push(r);
    }
  }

  const skipped = skippedMissingTitle + skippedMissingSku;
  const skippedReasons: string[] = [];
  if (skippedMissingTitle > 0) skippedReasons.push(`${skippedMissingTitle} missing a title`);
  if (skippedMissingSku > 0) skippedReasons.push(`${skippedMissingSku} missing a required SKU`);

  if (withSku.length === 0 && withoutSku.length === 0) {
    return NextResponse.json({
      succeeded: true,
      data: { imported: 0, skipped, skippedReasons },
      errors: [],
      message: 'No valid rows to import',
    });
  }

  const supabase = await createClient();
  const needsCategory = [...withSku, ...withoutSku].filter((r) => !r.categoryId);
  const toCategorize = needsCategory.slice(0, AUTO_CATEGORIZE_MAX_ROWS);
  let leftUncategorized = needsCategory.length - toCategorize.length;

  if (toCategorize.length > 0) {
    const { data: categories } = await supabase.from('seller_categories').select('id, slug, name');

    if (categories && categories.length > 0) {
      const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
      const categoryList = categories.map((c) => ({ slug: c.slug, name: c.name }));

      const batches: ImportRow[][] = [];
      for (let i = 0; i < toCategorize.length; i += CATEGORIZE_BATCH_SIZE) {
        batches.push(toCategorize.slice(i, i + CATEGORIZE_BATCH_SIZE));
      }

      let systemicFailure = false;
      for (let i = 0; i < batches.length && !systemicFailure; i += CATEGORIZE_CONCURRENCY) {
        const wave = batches.slice(i, i + CATEGORIZE_CONCURRENCY);
        const waveResults = await Promise.all(
          wave.map(async (batch) => {
            try {
              return await suggestCategoriesBatch(
                batch.map((r) => r.title!),
                categoryList,
              );
            } catch (err) {
              // Groq not configured (or some other systemic failure) - no
              // point retrying the remaining batches one by one, they'll
              // all fail the same way. Rows in unprocessed batches simply
              // keep category_id: null, same as today.
              if (err instanceof GroqNotConfiguredError) systemicFailure = true;
              // Return type stated explicitly so this branch lines up with the
              // success branch above - without it TS 5 infers `any[]` here and
              // the whole Promise.all result loses its type.
              return batch.map(
                (): Awaited<ReturnType<typeof suggestCategoriesBatch>>[number] => null,
              );
            }
          }),
        );

        wave.forEach((batch, batchIndex) => {
          waveResults[batchIndex].forEach((suggestion, rowIndex) => {
            if (suggestion) {
              const categoryId = bySlug.get(suggestion.categorySlug);
              if (categoryId) batch[rowIndex].categoryId = categoryId;
            }
          });
        });
      }

      // Recount directly from final state rather than tracking counts
      // through the loop above - correct regardless of where (or whether)
      // a systemic failure stopped processing early.
      leftUncategorized += toCategorize.filter((r) => !r.categoryId).length;
    } else {
      leftUncategorized += toCategorize.length;
    }
  }

  const toRow = (r: ImportRow, importKey: string | null) => ({
    seller_id: seller.id,
    sku: r.sku || null,
    import_key: importKey,
    title: r.title,
    category_id: r.categoryId || null,
    cost_price: r.costPrice ?? null,
    sell_price: r.sellPrice ?? null,
    stock_qty: r.stockQty ?? null,
    is_active: r.isActive ?? true,
    image_url: r.imageUrl?.trim() || null,
    currency: r.currency && VALID_CURRENCY_CODES.has(r.currency) ? r.currency : defaultCurrency,
    updated_at: new Date().toISOString(),
  });

  // Two batches, not one: Supabase's upsert() takes a single conflict
  // target for the whole call, and has-SKU / no-SKU rows need different
  // ones (seller_id,sku vs seller_id,import_key).
  if (withSku.length > 0) {
    const { error } = await supabase
      .from('seller_products')
      .upsert(withSku.map((r) => toRow(r, null)), { onConflict: 'seller_id,sku' });

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to import products' },
        { status: 400 },
      );
    }
  }

  if (withoutSku.length > 0) {
    const { error } = await supabase
      .from('seller_products')
      .upsert(
        withoutSku.map((r) => toRow(r, slugifyTitle(r.title!))),
        { onConflict: 'seller_id,import_key' },
      );

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to import products' },
        { status: 400 },
      );
    }
  }

  // Auto-track any category these rows landed in that isn't already a
  // domain - see autoAssignDomainsForCategories()'s own comment for why
  // this matters (a category with no domain never surfaces on Market
  // Definition/Competitors, even though the products themselves import
  // fine). Runs after both product upserts succeed, using the categoryId
  // each row actually ended up with (manually mapped or Groq-suggested).
  const importedCategoryIds = [...withSku, ...withoutSku]
    .map((r) => r.categoryId)
    .filter((id): id is string => Boolean(id));
  const domainResult = await autoAssignDomainsForCategories(seller, importedCategoryIds);

  return NextResponse.json({
    succeeded: true,
    data: {
      imported: withSku.length + withoutSku.length,
      skipped,
      skippedReasons,
      leftUncategorized,
      domainsAdded: domainResult.added.length,
      domainsNeedingPremium: domainResult.skippedNeedsPremium.length,
    },
    errors: [],
    message: 'Products imported successfully',
  });
}
