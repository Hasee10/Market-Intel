import { NextRequest, NextResponse } from 'next/server';

import { computeChurnSnapshots } from '@/lib/market-intel/jobs/churn-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';
import { cronError } from '@/lib/api-error';

async function run(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Unauthorized'], message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await computeChurnSnapshots();
    return NextResponse.json({ succeeded: true, data: result, errors: [], message: 'Churn snapshots computed' });
  } catch (error) {
    return cronError(error, 'Failed to compute churn snapshots', 'api/cron/churn');
  }
}

export const GET = run;
export const POST = run;
