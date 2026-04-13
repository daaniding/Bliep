'use client';

import { useEffect, useState } from 'react';
import { loadTrophies, addTrophies, TROPHIES_CHANGED_EVENT } from './trophies';

export function useTrophies() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    setCount(loadTrophies().count);
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'number') setCount(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bliep:trophies:v1') {
        try {
          const c = JSON.parse(e.newValue ?? '{}').count ?? 0;
          setCount(c);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener(TROPHIES_CHANGED_EVENT, onCustom as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(TROPHIES_CHANGED_EVENT, onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function award(delta: number, reason: string) {
    const next = addTrophies(delta, reason);
    setCount(next.count);
  }

  return { trophies: count, awardTrophies: award };
}
