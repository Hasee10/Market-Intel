import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { GroqNotConfiguredError, suggestCategory } from '@/lib/ai/suggest-category';

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const title: string = (body.title ?? '').trim();
  if (title.length < 2) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['A product title is required'], message: 'A product title is required' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: categories, error } = await supabase.from('seller_categories').select('id, slug, name');

  if (error || !categories || categories.length === 0) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Failed to load categories'], message: 'Failed to load categories' },
      { status: 500 },
    );
  }

  try {
    const suggestion = await suggestCategory(
      title,
      categories.map((c) => ({ slug: c.slug, name: c.name })),
    );
    const matched = categories.find((c) => c.slug === suggestion.categorySlug)!;

    return NextResponse.json({
      succeeded: true,
      data: { categoryId: matched.id, categoryName: matched.name, confidence: suggestion.confidence },
      errors: [],
      message: 'Category suggested successfully',
    });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [err.message], message: err.message },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        message: 'Failed to suggest a category',
      },
      { status: 500 },
    );
  }
}
