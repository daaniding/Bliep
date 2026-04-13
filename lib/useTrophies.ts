'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { loadTrophies, addTrophies, saveTrophies, TROPHIES_CHANGED_EVENT } from './trophies';
import { useUser } from './useUser';

// When logged in, the server is the source of truth. Local trophy state is
// merged into the server on first sync, then mirrored from the server.
// When logged out, falls back to localStorage entirely.
export function useTrophies() {
  const { user, loading: userLoading } = useUser();
  const [count, setCount] = useState<number>(0);
  const synced = useRef(false);

  // Load + sync
  useEffect(() => {
    if (userLoading) return;
    const local = loadTrophies();
    if (!user) {
      setCount(local.count);
      synced.current = false;
      return;
    }
    if (synced.current) return;
    synced.current = true;
    // First time logged in: send local count to server, store the merged max
    fetch('/api/me/trophies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ localCount: local.count }),
    })
      .then(r => r.json())
      .then(data => {
        if (typeof data.trophies === 'number') {
          setCount(data.trophies);
          // Mirror server count into localStorage so the rest of the app
          // (which still reads loadTrophies() in places) stays consistent.
          saveTrophies({ count: data.trophies, history: local.history });
        }
      })
      .catch(() => setCount(local.count));
  }, [user, userLoading]);

  // Listen for local changes (used both logged-in and logged-out)
  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'number') setCount(detail);
    };
    window.addEventListener(TROPHIES_CHANGED_EVENT, onCustom as EventListener);
    return () => window.removeEventListener(TROPHIES_CHANGED_EVENT, onCustom as EventListener);
  }, []);

  const award = useCallback((delta: number, reason: string) => {
    // Always update local first for instant feedback
    const next = addTrophies(delta, reason);
    setCount(next.count);
    // If logged in, push delta to server (server is source of truth)
    if (user) {
      fetch('/api/me/trophies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delta, reason }),
      })
        .then(r => r.json())
        .then(data => {
          if (typeof data.trophies === 'number') {
            setCount(data.trophies);
            saveTrophies({ count: data.trophies, history: next.history });
          }
        })
        .catch(() => { /* keep optimistic local update */ });
    }
  }, [user]);

  return { trophies: count, awardTrophies: award };
}
