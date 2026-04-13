'use client';

const MY_LEAGUES_KEY = 'bliep:my-leagues';
const DISPLAY_NAME_KEY = 'bliep:displayName';

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

export function getMyLeagues(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MY_LEAGUES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function rememberLeague(code: string) {
  if (typeof window === 'undefined') return;
  const list = getMyLeagues();
  if (!list.includes(code)) {
    list.push(code);
    localStorage.setItem(MY_LEAGUES_KEY, JSON.stringify(list));
  }
}

export function forgetLeague(code: string) {
  if (typeof window === 'undefined') return;
  const list = getMyLeagues().filter(c => c !== code);
  localStorage.setItem(MY_LEAGUES_KEY, JSON.stringify(list));
}

export function getDisplayName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
}

export function setDisplayName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

// --- API client functions ---

export async function apiCreateLeague(name: string, clientId: string, displayName: string): Promise<League> {
  const res = await fetch('/api/league', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, clientId, displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Kon league niet maken');
  return res.json();
}

export async function apiGetLeague(code: string): Promise<League> {
  const res = await fetch(`/api/league/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Niet gevonden');
  return res.json();
}

export async function apiJoinLeague(code: string, clientId: string, displayName: string): Promise<League> {
  const res = await fetch(`/api/league/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Joinen mislukt');
  return res.json();
}

export async function apiUpdateScore(code: string, clientId: string, trophies: number): Promise<League> {
  const res = await fetch(`/api/league/${encodeURIComponent(code)}/score`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, trophies }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Score sync mislukt');
  return res.json();
}
