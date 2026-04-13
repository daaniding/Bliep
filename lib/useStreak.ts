'use client';

import { useEffect, useState } from 'react';

const KEY = 'bliep:streak';

export interface StreakState {
  current: number;
  longest: number;
  lastCompletedDate: string;
  history: string[];
}

function load(): StreakState {
  if (typeof window === 'undefined') return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, history: parsed.history || [] };
    }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

export function useStreak() {
  const [state, setState] = useState<StreakState>({ current: 0, longest: 0, lastCompletedDate: '', history: [] });

  useEffect(() => {
    setState(load());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setState(load()); };
    window.addEventListener('storage', onStorage);
    // Also poll once a second so updates from same-tab writes are reflected.
    // (The streak helper writes via direct localStorage.setItem, no event.)
    const id = window.setInterval(() => setState(prev => {
      const next = load();
      if (next.current === prev.current && next.history.length === prev.history.length) return prev;
      return next;
    }), 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(id);
    };
  }, []);

  return state;
}
