import { NextResponse } from 'next/server';
import { joinLeague } from '@/lib/leagueStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await request.json();
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: 'Missing displayName' }, { status: 400 });
    const league = await joinLeague(code.toUpperCase(), clientId, displayName);
    if (!league) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    return NextResponse.json(league);
  } catch (err) {
    console.error('[league/join]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
