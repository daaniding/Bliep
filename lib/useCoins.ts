'use client';

import { useEffect, useState } from 'react';
import { loadCity, saveCity, addCoins, collectAllFarms, processBuildQueue, COINS_CHANGED_EVENT } from './cityStore';

// Hook that returns current coin balance and an awardCoins function. Listens
// for changes from other tabs (storage event) and the same tab (custom
// event) so /stad and the homepage stay in sync.
export function useCoins() {
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    // Initial: process build queue + auto-collect any pending farm coins
    const loaded = processBuildQueue(loadCity());
    const { state: claimed } = collectAllFarms(loaded);
    saveCity(claimed);
    setCoins(claimed.coins);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bliep:city:v2') {
        try {
          const c = JSON.parse(e.newValue ?? '{}').coins ?? 0;
          setCoins(c);
        } catch { /* ignore */ }
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'number') setCoins(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(COINS_CHANGED_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COINS_CHANGED_EVENT, onCustom as EventListener);
    };
  }, []);

  function award(amount: number) {
    const current = loadCity();
    const next = addCoins(current, amount);
    saveCity(next);
    setCoins(next.coins);
  }

  return { coins, award };
}
