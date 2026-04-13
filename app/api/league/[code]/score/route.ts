import { NextResponse } from 'next/server';
import { updateScore } from '@/lib/leagueStore';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await request.json();
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const trophies = typeof body.trophies === 'number' ? body.trophies : NaN;
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    if (!Number.isFinite(trophies)) return NextResponse.json({ error: 'Bad trophies' }, { status: 400 });
    const league = await updateScore(code.toUpperCase(), clientId, trophies);
    if (!league) return NextResponse.json({ error: 'Niet gevonden of geen lid' }, { status: 404 });
    return NextResponse.json(league);
  } catch (err) {
    console.error('[league/score]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
