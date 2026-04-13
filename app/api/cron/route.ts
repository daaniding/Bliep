import { NextResponse } from 'next/server';
import { getDailyTask } from '@/lib/tasks';
import { getDailyCompliment } from '@/lib/compliments';
import { sendPushNotification } from '@/lib/webpush';
import { getAllUsersWithSettings, removeSubscription } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getAmsterdamHour(): number {
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' });
  return parseInt(fmt.format(new Date()), 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = getAmsterdamHour();
  const isMorning = hour < 14;

  try {
    const users = await getAllUsersWithSettings();
    if (users.length === 0) {
      return NextResponse.json({ success: true, sent: 0, total: 0, message: 'No subscribers' });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const { subscription, settings } of users) {
      if (!settings.notifications) { skipped++; continue; }

      const greeting = settings.name ? `, ${settings.name}` : '';
      const task = getDailyTask();
      const compliment = getDailyCompliment();

      const title = isMorning ? `Goedemorgen${greeting}!` : `Goedenavond${greeting}!`;
      const body = isMorning ? `✅ ${task}` : `💬 ${compliment}`;

      try {
        const success = await sendPushNotification(subscription, {
          title,
          body,
          icon: '/icon-192.png',
          url: '/',
        });
        if (!success) {
          await removeSubscription(subscription.endpoint);
          failed++;
        } else {
          sent++;
        }
      } catch (err) {
        failed++;
        console.error('[CRON] send error:', err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({
      success: true,
      isMorning,
      sent,
      failed,
      skipped,
      total: users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CRON] Fatal:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
