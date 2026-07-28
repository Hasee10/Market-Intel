import { NextResponse } from 'next/server';
import { joinMarketIntelWaitlist, WaitlistError } from '@/lib/market-intel/waitlist-actions';
import { createRateLimiter, getClientIp } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';

const isRateLimited = createRateLimiter(5);

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const email = typeof body.email === 'string' ? body.email : '';
  const companyName = typeof body.companyName === 'string' ? body.companyName : null;

  try {
    await joinMarketIntelWaitlist(email, companyName);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WaitlistError) {
      const status = error.code === 'db_unavailable' ? 503 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('[api/market-intel/waitlist]', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
