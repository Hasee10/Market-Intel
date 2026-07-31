import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';
import { IProduct } from '@/types/products';

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PRODUCT_COLUMNS =
  'id, sku, title, category_id, cost_price, sell_price, currency, stock_qty, is_active, created_at, updated_at, seller_categories(name)';

export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const categoryId = request.nextUrl.searchParams.get('categoryId');

  const supabase = await createClient();
  let query = supabase
    .from('seller_products')
    .select(PRODUCT_COLUMNS)
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch products' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: (data ?? []).map(mapProduct),
    errors: [],
    message: 'Products retrieved successfully',
  });
}

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_products')
    .insert({
      seller_id: seller.id,
      title: body.title,
      sku: body.sku || null,
      category_id: body.categoryId || null,
      cost_price: body.costPrice ?? null,
      sell_price: body.sellPrice ?? null,
      currency: body.currency || 'PKR',
      stock_qty: body.stockQty ?? null,
      is_active: body.isActive ?? true,
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
