import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { addToWatchlist, listWatchlistProductIds, removeFromWatchlist } from '@/lib/market-intel/watchlist';

export const dynamic = 'force-dynamic';

async function requireMarketAccountId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'market_analyst') return null;
  return session.user.id;
}

export async function GET() {
  const accountId = await requireMarketAccountId();
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const productIds = await listWatchlistProductIds(accountId);
  return NextResponse.json({ productIds });
}

export async function POST(request: Request) {
  const accountId = await requireMarketAccountId();
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = body?.productId;
  if (typeof productId !== 'string' || !productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }

  await addToWatchlist(accountId, productId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const accountId = await requireMarketAccountId();
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }

  await removeFromWatchlist(accountId, productId);
  return NextResponse.json({ ok: true });
}
