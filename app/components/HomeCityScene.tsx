'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  loadCity,
  claimProduction,
  saveCity,
  type CityState,
  COINS_CHANGED_EVENT,
} from '@/lib/cityStore';
import { sfxTap } from '@/lib/sound';

const CityCanvas = dynamic(() => import('@/app/stad/CityCanvas'), { ssr: false });

/**
 * HomeCityScene — renders the real /stad Pixi CityCanvas inside a
 * fixed home container, read-only. State comes from loadCity() and
 * refreshes whenever the city changes (focus, storage, custom event,
 * polling fallback). Tapping anywhere navigates to /stad so the
 * player can actually build.
 */
export default function HomeCityScene() {
  const [state, setState] = useState<CityState | null>(null);

  useEffect(() => {
    // Initial load + claim production so offline coins show up.
    const loaded = loadCity();
    const { state: claimed } = claimProduction(loaded);
    saveCity(claimed);
    setState(claimed);

    const refresh = () => {
      setState(loadCity());
    };
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bliep:city:v1') refresh();
    };
    const onCoins = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener(COINS_CHANGED_EVENT, onCoins);
    // Also poll every 5s so freshly placed buildings show up even if the
    // tab never blurred. Cheap and bounded.
    const id = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COINS_CHANGED_EVENT, onCoins);
      window.clearInterval(id);
    };
  }, []);

  if (!state) return <div className="home-city-scene home-city-empty" />;

  return (
    <Link
      href="/stad"
      onClick={() => sfxTap()}
      className="home-city-scene"
      aria-label="Open je stad"
    >
      <div className="home-city-host">
        <CityCanvas
          state={state}
          onTapTile={() => {}}
          onTapBuilding={() => {}}
          className="home-city-canvas"
        />
      </div>

      <style jsx>{`
        .home-city-scene {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          overflow: hidden;
          text-decoration: none;
          cursor: pointer;
        }
        .home-city-empty {
          background: rgba(0, 0, 0, 0.25);
        }
        .home-city-host {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .home-city-host :global(.home-city-canvas) {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .home-city-host :global(canvas) {
          pointer-events: none !important;
        }
      `}</style>
    </Link>
  );
}
