import { NextResponse } from 'next/server';
import { getCurrentUser, getUserTrophies, addUserTrophies, syncUserTrophies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  const trophies = await getUserTrophies(user.id);
  return NextResponse.json({ trophies });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  const body = await request.json();
  if (typeof body.localCount === 'number') {
    const merged = await syncUserTrophies(user.id, body.localCount);
    return NextResponse.json({ trophies: merged });
  }
  if (typeof body.delta !== 'number') {
    return NextResponse.json({ error: 'delta required' }, { status: 400 });
  }
  const updated = await addUserTrophies(user.id, body.delta);
  return NextResponse.json({ trophies: updated });
}
