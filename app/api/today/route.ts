import { NextResponse } from 'next/server';
import { getDailyTask } from '@/lib/tasks';
import { getDailyCompliment } from '@/lib/compliments';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    task: getDailyTask(),
    compliment: getDailyCompliment(),
  });
}
