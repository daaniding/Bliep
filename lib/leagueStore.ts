import { getRedis } from './redis';

const LEAGUE_TTL_SECONDS = 90 * 24 * 3600; // 90 days

export interface LeagueMember {
  clientId: string;
  name: string;
  trophies: number;
  joinedAt: number;
  lastSync: number;
}

export interface League {
  code: string;
  name: string;
  createdAt: number;
  members: Record<string, LeagueMember>;
}

function key(code: string): string {
  return `bliep:league:${code}`;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
function generateCode(len = 6): string {
  let out = '';
  const arr = new Uint32Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  }
  for (let i = 0; i < len; i++) {
    const r = arr[i] || Math.floor(Math.random() * 0xffffffff);
    out += ALPHABET[r % ALPHABET.length];
  }
  return out;
}

export async function createLeague(name: string, founder: { clientId: string; displayName: string }): Promise<League> {
  const redis = getRedis();
  let code = generateCode();
  // Avoid the very rare collision
  for (let i = 0; i < 5; i++) {
    const exists = await redis.exists(key(code));
    if (!exists) break;
    code = generateCode();
  }
  const now = Date.now();
  const league: League = {
    code,
    name: name.slice(0, 40) || 'Naamloze league',
    createdAt: now,
    members: {
      [founder.clientId]: {
        clientId: founder.clientId,
        name: founder.displayName.slice(0, 24) || 'Anoniem',
        trophies: 0,
        joinedAt: now,
        lastSync: now,
      },
    },
  };
  await redis.set(key(code), league, { ex: LEAGUE_TTL_SECONDS });
  return league;
}

export async function getLeague(code: string): Promise<League | null> {
  const redis = getRedis();
  const league = await redis.get<League>(key(code));
  return league ?? null;
}

export async function joinLeague(code: string, clientId: string, displayName: string): Promise<League | null> {
  const redis = getRedis();
  const league = await redis.get<League>(key(code));
  if (!league) return null;
  const now = Date.now();
  if (!league.members[clientId]) {
    league.members[clientId] = {
      clientId,
      name: displayName.slice(0, 24) || 'Anoniem',
      trophies: 0,
      joinedAt: now,
      lastSync: now,
    };
  } else {
    league.members[clientId].name = displayName.slice(0, 24) || league.members[clientId].name;
    league.members[clientId].lastSync = now;
  }
  await redis.set(key(code), league, { ex: LEAGUE_TTL_SECONDS });
  return league;
}

export async function updateScore(code: string, clientId: string, trophies: number): Promise<League | null> {
  const redis = getRedis();
  const league = await redis.get<League>(key(code));
  if (!league) return null;
  if (!league.members[clientId]) return null;
  league.members[clientId].trophies = Math.max(0, Math.floor(trophies));
  league.members[clientId].lastSync = Date.now();
  await redis.set(key(code), league, { ex: LEAGUE_TTL_SECONDS });
  return league;
}
