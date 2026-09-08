import { NextRequest, NextResponse } from 'next/server';

import { refreshFxRates } from '@/lib/market-intel/jobs/fx-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

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
    return apiError(error, 'Failed to refresh FX rates', 500, 'api/cron/fx-rates');
  }
}

export const GET = run;
export const POST = run;
