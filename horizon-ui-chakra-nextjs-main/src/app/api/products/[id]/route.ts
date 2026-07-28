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
    stockQty: row.stock_qty,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  const body = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_products')
    .update({
      title: body.title,
      sku: body.sku || null,
      category_id: body.categoryId || null,
      cost_price: body.costPrice ?? null,
      sell_price: body.sellPrice ?? null,
      stock_qty: body.stockQty ?? null,
      is_active: body.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select('id, sku, title, category_id, cost_price, sell_price, stock_qty, is_active, created_at, updated_at, seller_categories(name)')
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to update product' },
      { status: 400 },
    );
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
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to delete product' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: null,
    errors: [],
    message: 'Product deleted successfully',
  });
}
