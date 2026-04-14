import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const KEY = (userId: string) => `bliep:user:${userId}:city`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  const redis = getRedis();
  const city = await redis.get(KEY(user.id));
  return NextResponse.json({ city: city ?? null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }
  const city = (body as { city?: unknown })?.city;
  if (!city || typeof city !== 'object') {
    return NextResponse.json({ error: 'city required' }, { status: 400 });
  }
  // Last-write-wins by updatedAt: only overwrite if remote is older.
  const redis = getRedis();
  const existing = await redis.get<{ updatedAt?: number }>(KEY(user.id));
  const existingTs = existing?.updatedAt ?? 0;
  const incomingTs = (city as { updatedAt?: number })?.updatedAt ?? Date.now();
  if (incomingTs >= existingTs) {
    await redis.set(KEY(user.id), city);
  }
  return NextResponse.json({ ok: true });
}
