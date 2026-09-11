import { NextRequest, NextResponse } from 'next/server';

import { computeDomainBenchmarks } from '@/lib/market-intel/jobs/benchmarks-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';
import { cronError } from '@/lib/api-error';

// Triggered on a schedule (see vercel.json's crons entry) to recompute
// domain_benchmarks. Also callable manually with the CRON_SECRET bearer
// token for testing. GET so it matches how Vercel Cron invokes routes;
// POST works too for manual/GH Actions triggering.
async function run(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Unauthorized'], message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await computeDomainBenchmarks();
    return NextResponse.json({
      succeeded: true,
      data: result,
      errors: [],
      message: 'Domain benchmarks recomputed',
    });
  } catch (error) {
    return cronError(error, 'Failed to recompute domain benchmarks', 'api/cron/benchmarks');
  }
}

export const GET = run;
export const POST = run;
