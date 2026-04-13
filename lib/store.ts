import { Redis } from '@upstash/redis';
import { PushSubscription } from './webpush';
import crypto from 'crypto';

const SUBS_KEY = 'bliep:subscriptions';

export interface UserSettings {
  name: string;
  city: string;
  lat: number;
  lon: number;
  morningTime: string; // "07:00"
  eveningTime: string; // "19:00"
  notifications: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  name: '',
  city: 'Breukelen',
  lat: 52.1715,
  lon: 4.9927,
  morningTime: '07:00',
  eveningTime: '19:00',
  notifications: true,
};

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

// --- Subscriptions ---

export async function getSubscriptions(): Promise<PushSubscription[]> {
  try {
    const redis = getRedis();
    const subs = await redis.get<PushSubscription[]>(SUBS_KEY);
    return subs || [];
  } catch {
    return [];
  }
}

export async function addSubscription(sub: PushSubscription): Promise<void> {
  const redis = getRedis();
  const subs = await getSubscriptions();
  const exists = subs.some(s => s.endpoint === sub.endpoint);
  if (!exists) {
    subs.push(sub);
    await redis.set(SUBS_KEY, subs);
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const redis = getRedis();
  const subs = await getSubscriptions();
  const filtered = subs.filter(s => s.endpoint !== endpoint);
  await redis.set(SUBS_KEY, filtered);
}

// --- User Settings ---

export async function getUserSettings(endpoint: string): Promise<UserSettings> {
  try {
    const redis = getRedis();
    const hash = hashEndpoint(endpoint);
    const settings = await redis.get<UserSettings>(`bliep:user:${hash}`);
    return settings || { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveUserSettings(endpoint: string, settings: Partial<UserSettings>): Promise<UserSettings> {
  const redis = getRedis();
  const hash = hashEndpoint(endpoint);
  const current = await getUserSettings(endpoint);
  const updated = { ...current, ...settings };
  await redis.set(`bliep:user:${hash}`, updated);
  return updated;
}

// --- Get all users with settings for cron ---

export async function getAllUsersWithSettings(): Promise<Array<{ subscription: PushSubscription; settings: UserSettings }>> {
  const subs = await getSubscriptions();
  const redis = getRedis();

  const results = await Promise.all(
    subs.map(async (sub) => {
      const hash = hashEndpoint(sub.endpoint);
      const settings = await redis.get<UserSettings>(`bliep:user:${hash}`);
      return {
        subscription: sub,
        settings: settings || { ...DEFAULT_SETTINGS },
      };
    })
  );

  return results;
}
