import { NextRequest, NextResponse } from 'next/server';

import { refreshFxRates } from '@/lib/market-intel/fx-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';

async function run(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Unauthorized'], message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await refreshFxRates();
    return NextResponse.json({ succeeded: true, data: result, errors: [], message: 'FX rates refreshed' });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to refresh FX rates',
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
