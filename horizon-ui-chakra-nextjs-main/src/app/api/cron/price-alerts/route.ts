import { NextRequest, NextResponse } from 'next/server';

import { runPriceAlertsJob } from '@/lib/market-intel/jobs/price-alerts-job';
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
    const result = await runPriceAlertsJob();
    return NextResponse.json({
      succeeded: true,
      data: result,
      errors: [],
      message: 'Price alerts job completed',
    });
  } catch (error) {
    return apiError(error, 'Failed to run price alerts job', 500, 'api/cron/price-alerts');
  }
}

export const GET = run;
export const POST = run;
