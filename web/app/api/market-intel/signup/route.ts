import { NextResponse } from 'next/server';
import { createMarketAccount, MarketAccountAuthError } from '@/lib/auth/market-accounts';
import { createRateLimiter, getClientIp } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';

const isRateLimited = createRateLimiter(3);

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName : '';

    const account = await createMarketAccount(email, password, companyName);

    return NextResponse.json({ success: true, email: account.email });
  } catch (error) {
    if (error instanceof MarketAccountAuthError) {
      const status = error.code === 'db_unavailable' ? 503 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('[api/market-intel/signup]', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
