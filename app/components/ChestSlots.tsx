'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CAMPS, loadPveState, cooldownRemainingMs, isOnCooldown, type PveCamp } from '@/lib/pveCamps';

function fmt(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}u`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

// Show the first 4 PvE camps as chest-style slots — gold frame, big icon,
// status badge with either "READY" or live countdown. Each tile links to
// /aanvallen.
export default function ChestSlots() {
  const [pveState, setPveState] = useState<Record<string, number>>({});
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    setPveState(loadPveState());
    const id = window.setInterval(() => {
      setNow(Date.now());
      setPveState(loadPveState());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const visible = CAMPS.slice(0, 4);

  return (
    <div className="grid grid-cols-4 gap-2">
      {visible.map(camp => (
        <ChestSlot key={camp.id} camp={camp} pveState={pveState} />
      ))}
    </div>
  );
}

function ChestSlot({ camp, pveState }: { camp: PveCamp; pveState: Record<string, number> }) {
  const cdLeft = cooldownRemainingMs(camp, pveState);
  const ready = !isOnCooldown(camp, pveState);

  return (
    <Link
      href="/aanvallen"
      className="block active:scale-95 transition-transform"
    >
      <div className={`gold-frame-sm ${ready ? 'animate-glow-pulse' : ''}`}>
        <div className="stone-panel p-2 flex flex-col items-center justify-between aspect-[3/4]">
          <span className="text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{camp.emoji}</span>
          <div className="w-full">
            {ready ? (
              <div className="bg-[var(--color-forest-500)] border border-[var(--color-forest-900)] rounded-md py-0.5 px-1 text-center">
                <p className="font-display font-bold text-[9px] text-white uppercase tracking-wider">Klaar</p>
              </div>
            ) : (
              <div className="bg-[var(--color-night-900)]/80 border border-[var(--color-gold-500)]/40 rounded-md py-0.5 px-1 text-center">
                <p className="font-display font-bold text-[10px] text-[var(--color-gold-200)] tabular-nums">{fmt(cdLeft)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
