import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { suggestCategory } from '@/lib/ai/suggest-category';
import { blankToNull, parseJsonBody } from '@/lib/api-validation';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getSellerProducts, mapProduct, PRODUCT_COLUMNS } from '@/lib/market-intel/seller/products';
import { createClient } from '@/lib/supabase/server';

// NewProductDrawer always sends sku/categoryId as '' rather than omitting
// them when left blank - blankToNull() keeps that meaning "not provided"
// instead of failing a min-length check.
const ProductCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  sku: blankToNull(z.string().trim().min(1)),
  categoryId: blankToNull(z.string().trim().min(1)),
  costPrice: z.number().nonnegative().nullish(),
  sellPrice: z.number().nonnegative().nullish(),
  currency: blankToNull(z.string().trim().min(1)),
  stockQty: z.number().int().nonnegative().nullish(),
  isActive: z.boolean().optional(),
  // Not z.string().url(): an empty string is how the UI signals "clear the
  // image", and url() would reject it. The write path normalises '' to null.
  imageUrl: z.string().optional(),
});

// GET is a thin wrapper - see products.ts's header comment for why the real
// logic lives there now.
export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const categoryId = request.nextUrl.searchParams.get('categoryId');

  try {
    const products = await getSellerProducts(seller.id, categoryId);

    return NextResponse.json({
      succeeded: true,
      data: products,
      errors: [],
      message: 'Products retrieved successfully',
    });
  } catch (err) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        message: 'Failed to fetch products',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const parsed = await parseJsonBody(request, ProductCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const supabase = await createClient();

  // Safety net for the "auto-assigned" guarantee: the frontend already
  // suggests a category as the seller types, but if a request arrives
  // without one anyway (a fast submit before the suggestion resolves, or
  // any other API caller), classify here rather than leaving it null.
  // Never blocks product creation - any failure just falls back to null,
  // same as if this block didn't run at all.
  let categoryId: string | null = body.categoryId || null;
  if (!categoryId && body.title) {
    try {
      const { data: categories } = await supabase.from('seller_categories').select('id, slug, name');
      if (categories && categories.length > 0) {
        const suggestion = await suggestCategory(
          body.title,
          categories.map((c) => ({ slug: c.slug, name: c.name })),
        );
        categoryId = categories.find((c) => c.slug === suggestion.categorySlug)?.id ?? null;
      }
    } catch {
      // Groq not configured, network error, bad response, etc. - leave
      // categoryId null and let the seller categorize manually later.
    }
  }

  const { data, error } = await supabase
    .from('seller_products')
    .insert({
      seller_id: seller.id,
      title: body.title,
      sku: body.sku || null,
      category_id: categoryId,
      cost_price: body.costPrice ?? null,
      sell_price: body.sellPrice ?? null,
      currency: body.currency || 'PKR',
      stock_qty: body.stockQty ?? null,
      is_active: body.isActive ?? true,
      // Empty string means "cleared", not "set to empty" - store null so
      // the UI falls back to the category tile.
      image_url: body.imageUrl?.trim() || null,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to create product' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: mapProduct(data),
    errors: [],
    message: 'Product created successfully',
  });
}
