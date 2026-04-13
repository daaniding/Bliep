import { NextResponse } from 'next/server';
import { getLeague } from '@/lib/leagueStore';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const league = await getLeague(code.toUpperCase());
    if (!league) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    return NextResponse.json(league);
  } catch (err) {
    console.error('[league/get]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
