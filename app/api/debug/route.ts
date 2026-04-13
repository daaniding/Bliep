import { NextResponse } from 'next/server';
import { getSubscriptions } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const kvUrl = process.env.KV_REST_API_URL;

  let subCount = 0;
  let subEndpoints: string[] = [];
  try {
    const subs = await getSubscriptions();
    subCount = subs.length;
    subEndpoints = subs.map(s => s.endpoint.slice(0, 60) + '...');
  } catch (e) {
    console.error('Debug: failed to get subs:', e);
  }

  return NextResponse.json({
    vapidPublicKey: pubKey ? pubKey.slice(0, 15) + '...' + pubKey.slice(-10) : 'NOT SET',
    vapidPublicKeyLength: pubKey?.length || 0,
    vapidPrivateKeySet: !!privKey,
    vapidPrivateKeyLength: privKey?.length || 0,
    cronSecretSet: !!cronSecret,
    redisUrlSet: !!kvUrl,
    subscriptionCount: subCount,
    subscriptionEndpoints: subEndpoints,
    timestamp: new Date().toISOString(),
  });
}
