import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/webpush';
import type { PushSubscription } from '@/lib/webpush';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription } = body as { subscription: PushSubscription };

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    console.log('[TEST-PUSH] Sending test notification to:', subscription.endpoint.slice(-30));

    const success = await sendPushNotification(subscription, {
      title: '🎉 Bliep werkt!',
      body: 'Je ontvangt nu notificaties. Elke ochtend en avond een positief bericht!',
      icon: '/icon-192.png',
      url: '/',
    });

    if (success) {
      console.log('[TEST-PUSH] Success!');
      return NextResponse.json({ success: true });
    } else {
      console.error('[TEST-PUSH] Failed - subscription may be expired');
      return NextResponse.json({ error: 'Push failed - subscription may be expired' }, { status: 410 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[TEST-PUSH] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
