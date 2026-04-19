'use client';

import { useEffect, useState } from 'react';
import { loadCity, type CityState } from './cityStore';
import { levelForXp, type LevelInfo } from './xp';

const CITY_EVENT = 'bliep:city-changed';

export function useXp(): { xp: number; info: LevelInfo } {
  const [xp, setXp] = useState<number>(0);

  useEffect(() => {
    try {
      setXp(loadCity().xp ?? 0);
    } catch { /* ignore */ }
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as CityState | undefined;
      if (detail && typeof detail.xp === 'number') setXp(detail.xp);
    };
    window.addEventListener(CITY_EVENT, onChange as EventListener);
    return () => window.removeEventListener(CITY_EVENT, onChange as EventListener);
  }, []);

  return { xp, info: levelForXp(xp) };
}
