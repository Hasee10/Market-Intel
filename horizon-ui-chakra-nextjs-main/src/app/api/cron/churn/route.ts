import { NextRequest, NextResponse } from 'next/server';

import { computeChurnSnapshots } from '@/lib/market-intel/churn-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';

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
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to compute churn snapshots',
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
