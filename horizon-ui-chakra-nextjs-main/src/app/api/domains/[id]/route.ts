import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller, listSellerDomains } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

// Sets this domain as primary (and unsets any other) - the primary domain
// is what getPrimaryDomain() uses to decide which category the Market page
// benchmarks against.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  await supabase.from('seller_domains').update({ is_primary: false }).eq('seller_id', seller.id);
  const { error } = await supabase
    .from('seller_domains')
    .update({ is_primary: true })
    .eq('id', id)
    .eq('seller_id', seller.id);

  if (error) {
    return apiError(error, 'Failed to set primary domain', 400, 'api/domains/[id]');
  }

  const domains = await listSellerDomains(seller.id);
  return NextResponse.json({ succeeded: true, data: domains, errors: [], message: 'Primary domain updated' });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: domain } = await supabase
    .from('seller_domains')
    .select('is_primary')
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();

  const { error } = await supabase.from('seller_domains').delete().eq('id', id).eq('seller_id', seller.id);

  if (error) {
    return apiError(error, 'Failed to remove domain', 400, 'api/domains/[id]');
  }

  // If the removed domain was primary, promote the next remaining one (if
  // any) so getPrimaryDomain() doesn't silently go null after a deletion.
  if (domain?.is_primary) {
    const { data: remaining } = await supabase
      .from('seller_domains')
      .select('id')
      .eq('seller_id', seller.id)
      .limit(1)
      .maybeSingle();

    if (remaining) {
      await supabase.from('seller_domains').update({ is_primary: true }).eq('id', remaining.id);
    }
  }

  const domains = await listSellerDomains(seller.id);
  return NextResponse.json({ succeeded: true, data: domains, errors: [], message: 'Domain removed successfully' });
}
