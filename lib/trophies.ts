'use client';

import type { TaskTier } from './dailyTasks';

const STORAGE_KEY = 'bliep:trophies:v1';
const TROPHIES_EVENT = 'bliep:trophies-changed';

export interface TrophyEntry {
  date: string;
  delta: number;
  reason: string;
}

export interface TrophyState {
  count: number;
  history: TrophyEntry[];
}

const TIER_TROPHIES: Record<TaskTier, number> = {
  easy: 1,
  medium: 3,
  hard: 8,
};

export function trophiesForTier(tier: TaskTier): number {
  return TIER_TROPHIES[tier];
}

function emptyState(): TrophyState {
  return { count: 0, history: [] };
}

export function loadTrophies(): TrophyState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TrophyState;
  } catch { /* ignore */ }
  return emptyState();
}

export function saveTrophies(state: TrophyState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(TROPHIES_EVENT, { detail: state.count }));
}

export function addTrophies(delta: number, reason: string): TrophyState {
  const current = loadTrophies();
  const entry: TrophyEntry = {
    date: new Date().toISOString(),
    delta,
    reason,
  };
  const next: TrophyState = {
    count: Math.max(0, current.count + delta),
    history: [entry, ...current.history].slice(0, 50),
  };
  saveTrophies(next);
  return next;
}

export const TROPHIES_CHANGED_EVENT = TROPHIES_EVENT;
