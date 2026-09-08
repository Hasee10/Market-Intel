import { NextRequest, NextResponse } from 'next/server';

import { runLowStockJob } from '@/lib/market-intel/jobs/low-stock-job';
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
    const result = await runLowStockJob();
    return NextResponse.json({ succeeded: true, data: result, errors: [], message: 'Low stock job completed' });
  } catch (error) {
    return apiError(error, 'Failed to run low stock job', 500, 'api/cron/low-stock');
  }
}

export const GET = run;
export const POST = run;
