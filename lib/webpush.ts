import webpush from 'web-push';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }
  console.log('[WEBPUSH] Initializing with public key:', publicKey.slice(0, 10) + '... (length:', publicKey.length + ')');
  webpush.setVapidDetails('mailto:bliep@example.com', publicKey, privateKey);
  initialized = true;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  try {
    ensureInitialized();
    console.log('[WEBPUSH] Sending to endpoint:', subscription.endpoint.slice(0, 60) + '...');
    console.log('[WEBPUSH] Subscription keys present:', !!subscription.keys?.p256dh, !!subscription.keys?.auth);

    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify(payload)
    );
    console.log('[WEBPUSH] Success!');
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string; message?: string; headers?: Record<string, string> };
    console.error('[WEBPUSH] Failed with status:', err.statusCode);
    console.error('[WEBPUSH] Error message:', err.message);
    console.error('[WEBPUSH] Error body:', err.body);
    console.error('[WEBPUSH] Endpoint was:', subscription.endpoint);

    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error('[WEBPUSH] Subscription expired/invalid - will be removed');
      return false;
    }
    return false;
  }
}
