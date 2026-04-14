'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { loadCity, processBuildQueue, CITY_CHANGED_EVENT, type CityState } from '@/lib/cityStore';

const CityCanvas = dynamic(() => import('../stad/CityCanvas'), { ssr: false });

/**
 * Mini, non-interactive replica of the city. Renders the same CityCanvas
 * in preview mode so home and /stad never drift.
 */
export default function CityPreview() {
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

  if (!state) {
    return <div className="absolute inset-0 bg-[#6b9c52]" />;
  }

  const buildingCount = state.buildings.length;
  const cityLevel = state.buildings.reduce((s, b) => s + b.level, 0);

  return (
    <Link href="/stad" className="absolute inset-0 block group" aria-label="Open je stad">
      {/* The city render itself */}
      <div className="absolute inset-0 bg-[#6b9c52]" />
      <CityCanvas state={state} mode="preview" showBuildZone={false} />

      {/* Subtle vignette so HUD text reads */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a06]/40 via-transparent to-[#0d0a06]/30 pointer-events-none" />

      {/* Top label — "je rijk" */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
        <span className="text-base">🏰</span>
        <p className="font-display text-[11px] uppercase tracking-widest text-[#fdd069] text-stroke-dark">
          Je Rijk
        </p>
        <span className="text-base">⚔️</span>
      </div>

      {/* Stat badges */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
        <div className="bg-[#0d0a06]/80 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">🏠</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{buildingCount}</span>
        </div>
        <div className="bg-[#0d0a06]/80 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">⭐</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{cityLevel}</span>
        </div>
        <div className="bg-[#0d0a06]/80 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1 group-active:scale-95 transition-transform">
          <span className="text-[11px]">👆</span>
          <span className="font-display text-[10px] text-[#fdd069] uppercase tracking-wider">Open</span>
        </div>
      </div>

      {/* Floating poppetjes ambient — pure decoration */}
      <FloatingEmojis />
    </Link>
  );
}

function FloatingEmojis() {
  // Pseudo-random positions that don't change per render
  const items = [
    { emoji: '🌳', top: '15%', left: '8%', delay: '0s', duration: '4s' },
    { emoji: '🌸', top: '25%', right: '12%', delay: '0.8s', duration: '5s' },
    { emoji: '🦋', top: '40%', left: '15%', delay: '1.2s', duration: '6s' },
    { emoji: '🌿', top: '60%', right: '8%', delay: '0.4s', duration: '4.5s' },
    { emoji: '✨', top: '20%', left: '50%', delay: '2s', duration: '3.5s' },
    { emoji: '🐦', top: '50%', right: '25%', delay: '1.6s', duration: '5.5s' },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((it, i) => (
        <span
          key={i}
          className="absolute text-base opacity-80"
          style={{
            top: it.top,
            left: it.left,
            right: it.right,
            animation: `float ${it.duration} ease-in-out ${it.delay} infinite`,
          }}
        >
          {it.emoji}
        </span>
      ))}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
