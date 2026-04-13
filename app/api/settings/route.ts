import { NextResponse } from 'next/server';
import { getUserSettings, saveUserSettings } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  const settings = await getUserSettings(endpoint);
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, settings } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    const updated = await saveUserSettings(endpoint, settings);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
