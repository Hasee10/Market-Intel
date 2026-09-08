import { NextRequest, NextResponse } from 'next/server';

import { runPushNotificationsJob } from '@/lib/market-intel/jobs/push-notifications-job';
import { isAuthorizedCronRequest } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

// Same shape as every other /api/cron/* handler: bearer CRON_SECRET,
// GET and POST both wired so the GitHub Actions workflow can curl it.

async function run(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Unauthorized'], message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await runPushNotificationsJob();
    return NextResponse.json({
      succeeded: true,
      data: result,
      errors: [],
      message: 'Push notifications job completed',
    });
  } catch (error) {
    return apiError(error, 'Failed to run push notifications job', 500, 'api/cron/push-notifications');
  }
}

export const GET = run;
export const POST = run;
