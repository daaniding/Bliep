'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { loadCity, processBuildQueue, CITY_CHANGED_EVENT, type CityState } from '@/lib/cityStore';

const CityCanvas = dynamic(() => import('../stad/CityCanvas'), { ssr: false });

/**
 * Live mini-replica of the city: actual CityCanvas in preview mode,
 * rendered inside a contained square card. Same engine as /stad — never
 * drifts. No interaction (tap-through opens /stad).
 */
interface Props {
  bare?: boolean;
}

export default function CityPreview({ bare = false }: Props) {
  const [state, setState] = useState<CityState | null>(null);

  useEffect(() => {
    setState(processBuildQueue(loadCity()));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setState(detail as CityState);
    };
    window.addEventListener(CITY_CHANGED_EVENT, onChange as EventListener);
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setState(s => (s ? processBuildQueue(s) : loadCity()));
    }, 10_000);
    return () => {
      window.removeEventListener(CITY_CHANGED_EVENT, onChange as EventListener);
      clearInterval(id);
    };
  }, []);

  const buildingCount = state?.buildings.length ?? 0;
  const cityLevel = state?.buildings.reduce((s, b) => s + b.level, 0) ?? 0;

  if (bare) {
    return (
      <div
        className="relative block w-full h-full overflow-hidden"
        style={{ background: '#6b9c52' }}
        aria-label="Stad"
      >
        {state && (
          <div className="absolute inset-0 pointer-events-none">
            <CityCanvas state={state} mode="interactive" showBuildZone={false} contained />
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href="/stad"
      className="relative block w-full h-full group overflow-hidden rounded-2xl border-4 border-[#1a0f05] shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-transform"
      style={{ background: '#6b9c52' }}
      aria-label="Open je stad"
    >
      {state && (
        <div className="absolute inset-0 pointer-events-none">
          <CityCanvas state={state} mode="interactive" showBuildZone={false} contained />
        </div>
      )}

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" />

      {/* Top label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none z-10">
        <span className="text-base">🏰</span>
        <p className="font-display text-[11px] uppercase tracking-widest text-[#fdd069] text-stroke-dark">
          Je Rijk
        </p>
        <span className="text-base">⚔️</span>
      </div>

      {/* Stat badges */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none z-10">
        <div className="bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">🏠</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{buildingCount}</span>
        </div>
        <div className="bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">⭐</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{cityLevel}</span>
        </div>
        <div className="bg-[#fdd069] border-2 border-[#1a0f05] rounded-full px-3 py-0.5 flex items-center gap-1 group-active:translate-y-[1px]">
          <span className="text-[10px]">👆</span>
          <span className="font-display text-[10px] text-[#1a0f05] uppercase tracking-wider">Bouw mee</span>
        </div>
      </div>
    </Link>
  );
}
