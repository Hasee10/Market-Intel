import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { blankToNull, parseJsonBody } from '@/lib/api-validation';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { IProduct } from '@/types/products';
import { apiError } from '@/lib/api-error';

// Mirrors ProductCreateSchema in ../route.ts, with one deliberate
// difference: title is optional here. The update writes `title: body.title`
// bare, and an undefined value is dropped during JSON serialisation, so an
// omitted title currently leaves the column untouched. Requiring it would
// reject partial updates that succeed today.
//
// The nonnegative() bounds do match create, which does tighten this route:
// a negative cost/sell price or stock count is accepted here today and
// won't be after this. Create has always rejected those, and update writing
// data create would refuse is not a distinction worth keeping.
const ProductUpdateSchema = z.object({
  title: z.string().trim().min(1, 'title cannot be empty').optional(),
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

function mapProduct(row: any): IProduct {
  const category = Array.isArray(row.seller_categories)
    ? row.seller_categories[0]
    : row.seller_categories;

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    currency: row.currency,
    stockQty: row.stock_qty,
    isActive: row.is_active,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PRODUCT_COLUMNS =
  'id, sku, title, category_id, cost_price, sell_price, currency, stock_qty, is_active, image_url, created_at, updated_at, seller_categories(name)';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const parsed = await parseJsonBody(request, ProductUpdateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_products')
    .update({
      title: body.title,
      sku: body.sku || null,
      category_id: body.categoryId || null,
      cost_price: body.costPrice ?? null,
      sell_price: body.sellPrice ?? null,
      currency: body.currency || 'PKR',
      stock_qty: body.stockQty ?? null,
      is_active: body.isActive ?? true,
      // Empty string means "cleared", not "set to empty" - store null so
      // the UI falls back to the category tile.
      image_url: body.imageUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    return apiError(error, 'Failed to update product', 400, 'api/products/[id]');
  }

  return NextResponse.json({
    succeeded: true,
    data: mapProduct(data),
    errors: [],
    message: 'Product updated successfully',
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('seller_products')
    .delete()
    .eq('id', id)
    .eq('seller_id', seller.id);

  if (error) {
    return apiError(error, 'Failed to delete product', 400, 'api/products/[id]');
  }

  return NextResponse.json({
    succeeded: true,
    data: null,
    errors: [],
    message: 'Product deleted successfully',
  });
}
