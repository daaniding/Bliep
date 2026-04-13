import { NextResponse } from 'next/server';
import { signup, createSession, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';
    if (!username || !password) {
      return NextResponse.json({ error: 'Naam en wachtwoord verplicht' }, { status: 400 });
    }
    const user = await signup(username, password, displayName);
    await createSession(user.id);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[auth/signup]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
