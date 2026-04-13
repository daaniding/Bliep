import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getRedis } from './redis';

const SESSION_COOKIE = 'bliep_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const USER_PREFIX = 'bliep:user:';
const USERNAME_INDEX_PREFIX = 'bliep:user:by-username:';
const SESSION_PREFIX = 'bliep:session:';

export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
}

interface StoredUser extends User {
  passwordHash: string;
  passwordSalt: string;
}

export class AuthError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function publicUser(stored: StoredUser): User {
  return {
    id: stored.id,
    username: stored.username,
    displayName: stored.displayName,
    createdAt: stored.createdAt,
  };
}

export async function signup(username: string, password: string, displayName: string): Promise<User> {
  const norm = normalizeUsername(username);
  if (!/^[a-z0-9_-]{3,24}$/.test(norm)) {
    throw new AuthError('Gebruikersnaam moet 3-24 letters/cijfers/_- zijn');
  }
  if (password.length < 6) {
    throw new AuthError('Wachtwoord moet minstens 6 tekens hebben');
  }
  const cleanDisplayName = displayName.trim().slice(0, 24) || norm;

  const redis = getRedis();
  const existing = await redis.get(`${USERNAME_INDEX_PREFIX}${norm}`);
  if (existing) throw new AuthError('Deze naam is al bezet', 409);

  const id = crypto.randomUUID();
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const stored: StoredUser = {
    id,
    username: norm,
    displayName: cleanDisplayName,
    createdAt: Date.now(),
    passwordHash,
    passwordSalt: salt,
  };

  await redis.set(`${USER_PREFIX}${id}`, stored);
  await redis.set(`${USERNAME_INDEX_PREFIX}${norm}`, id);

  return publicUser(stored);
}

export async function login(username: string, password: string): Promise<User> {
  const norm = normalizeUsername(username);
  const redis = getRedis();
  const userId = await redis.get<string>(`${USERNAME_INDEX_PREFIX}${norm}`);
  if (!userId) throw new AuthError('Ongeldige naam of wachtwoord', 401);
  const stored = await redis.get<StoredUser>(`${USER_PREFIX}${userId}`);
  if (!stored) throw new AuthError('Ongeldige naam of wachtwoord', 401);
  if (!verifyPassword(password, stored.passwordSalt, stored.passwordHash)) {
    throw new AuthError('Ongeldige naam of wachtwoord', 401);
  }
  return publicUser(stored);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const redis = getRedis();
  await redis.set(`${SESSION_PREFIX}${token}`, { userId, createdAt: Date.now() }, { ex: SESSION_TTL_SECONDS });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const redis = getRedis();
    await redis.del(`${SESSION_PREFIX}${token}`);
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const redis = getRedis();
  const session = await redis.get<{ userId: string }>(`${SESSION_PREFIX}${token}`);
  if (!session?.userId) return null;
  const stored = await redis.get<StoredUser>(`${USER_PREFIX}${session.userId}`);
  if (!stored) return null;
  return publicUser(stored);
}

export async function getUserById(userId: string): Promise<User | null> {
  const redis = getRedis();
  const stored = await redis.get<StoredUser>(`${USER_PREFIX}${userId}`);
  if (!stored) return null;
  return publicUser(stored);
}

export async function updateDisplayName(userId: string, displayName: string): Promise<User | null> {
  const redis = getRedis();
  const stored = await redis.get<StoredUser>(`${USER_PREFIX}${userId}`);
  if (!stored) return null;
  stored.displayName = displayName.trim().slice(0, 24) || stored.username;
  await redis.set(`${USER_PREFIX}${userId}`, stored);
  return publicUser(stored);
}

// --- Per-user trophy state (server-side source of truth when logged in) ---

const TROPHIES_KEY = (userId: string) => `bliep:user:${userId}:trophies`;

export async function getUserTrophies(userId: string): Promise<number> {
  const redis = getRedis();
  const v = await redis.get<number>(TROPHIES_KEY(userId));
  return typeof v === 'number' ? v : 0;
}

export async function setUserTrophies(userId: string, value: number): Promise<number> {
  const redis = getRedis();
  const safe = Math.max(0, Math.floor(value));
  await redis.set(TROPHIES_KEY(userId), safe);
  return safe;
}

export async function addUserTrophies(userId: string, delta: number): Promise<number> {
  const current = await getUserTrophies(userId);
  return setUserTrophies(userId, current + delta);
}

export async function syncUserTrophies(userId: string, localCount: number): Promise<number> {
  // Merge strategy: keep the higher of server vs local. Avoids destroying
  // device progress on first login.
  const current = await getUserTrophies(userId);
  if (localCount > current) return setUserTrophies(userId, localCount);
  return current;
}
