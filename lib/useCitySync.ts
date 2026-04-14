'use client';

import { useEffect, useRef } from 'react';
import { useUser } from './useUser';
import { mergeCity, saveCity, type CityState } from './cityStore';

/**
 * Best-effort 2-way sync of the local CityState with the server.
 * - On mount (and login change): GET /api/city, merge by updatedAt, then save.
 * - Throttled PUT /api/city on state changes (max 1 per 30s + on unmount).
 */
export function useCitySync(
  state: CityState,
  setState: (s: CityState) => void,
  enabled: boolean,
) {
  const { user } = useUser();
  const lastPushRef = useRef<number>(0);
  const pendingTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Initial pull on login
  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/city', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.city) return;
        const merged = mergeCity(stateRef.current, data.city as CityState);
        if (merged !== stateRef.current) {
          setState(merged);
          saveCity(merged);
        }
      } catch { /* offline ok */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, enabled]);

  // Push throttled
  useEffect(() => {
    if (!enabled || !user) return;
    const now = Date.now();
    const sinceLast = now - lastPushRef.current;
    const push = async () => {
      try {
        await fetch('/api/city', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ city: stateRef.current }),
        });
        lastPushRef.current = Date.now();
      } catch { /* offline ok */ }
    };
    if (sinceLast > 30_000) {
      void push();
    } else {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = window.setTimeout(push, 30_000 - sinceLast);
    }
    return () => {
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, enabled, user?.id]);

  // Push on unmount
  useEffect(() => {
    return () => {
      if (!user) return;
      const body = JSON.stringify({ city: stateRef.current });
      try {
        navigator.sendBeacon?.('/api/city', new Blob([body], { type: 'application/json' }));
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
