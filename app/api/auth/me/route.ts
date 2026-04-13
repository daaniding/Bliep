import { NextResponse } from 'next/server';
import { getCurrentUser, updateDisplayName } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  const body = await request.json();
  if (typeof body.displayName === 'string') {
    const updated = await updateDisplayName(user.id, body.displayName);
    return NextResponse.json({ user: updated });
  }
  return NextResponse.json({ user });
}
