import { NextResponse } from 'next/server';
import { createLeague } from '@/lib/leagueStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: 'Missing displayName' }, { status: 400 });
    const league = await createLeague(name, { clientId, displayName });
    return NextResponse.json(league);
  } catch (err) {
    console.error('[league/create]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
