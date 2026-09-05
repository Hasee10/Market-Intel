import { NextRequest, NextResponse } from 'next/server';

import { runPriceAlertsJob } from '@/lib/market-intel/jobs/price-alerts-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';

async function run(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Unauthorized'], message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await runPriceAlertsJob();
    return NextResponse.json({
      succeeded: true,
      data: result,
      errors: [],
      message: 'Price alerts job completed',
    });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to run price alerts job',
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
