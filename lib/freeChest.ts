'use client';

const KEY = 'bliep:free-chest:v1';
const COOLDOWN_MS = 4 * 60 * 60_000; // 4 hours
const MIN_REWARD = 30;
const MAX_REWARD = 120;

export interface FreeChestState {
  lastClaimedAt: number;
}

function empty(): FreeChestState {
  // Allow immediate claim on first install
  return { lastClaimedAt: 0 };
}

export function loadFreeChest(): FreeChestState {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FreeChestState;
  } catch { /* ignore */ }
  return empty();
}

function save(state: FreeChestState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function msUntilReady(state: FreeChestState): number {
  const elapsed = Date.now() - state.lastClaimedAt;
  return Math.max(0, COOLDOWN_MS - elapsed);
}

export function isReady(state: FreeChestState): boolean {
  return msUntilReady(state) === 0;
}

export function claimFreeChest(): { reward: number } | null {
  const state = loadFreeChest();
  if (!isReady(state)) return null;
  // Random coin reward, uniform between MIN and MAX (rounded to 5)
  const raw = MIN_REWARD + Math.random() * (MAX_REWARD - MIN_REWARD);
  const reward = Math.round(raw / 5) * 5;
  save({ lastClaimedAt: Date.now() });
  return { reward };
}
