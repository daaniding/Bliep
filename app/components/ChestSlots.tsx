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

// Map each camp to a Kenney structure sprite (pixel-art tile).
const CAMP_SPRITE: Record<string, string> = {
  bandiet: '/assets/kenney/buildings/medievalStructure_03.png', // small hut
  wolven: '/assets/kenney/environment/medievalEnvironment_08.png', // tree-ish
  fort: '/assets/kenney/buildings/medievalStructure_18.png',   // larger structure
  goblin: '/assets/kenney/buildings/medievalStructure_21.png', // dark structure
  draak: '/assets/kenney/buildings/medievalStructure_23.png',  // biggest
};

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
  const sprite = CAMP_SPRITE[camp.id] ?? '/assets/kenney/buildings/medievalStructure_01.png';

  return (
    <Link
      href="/aanvallen"
      className="block active:scale-95 transition-transform"
    >
      <div className={`kenney-panel-inset-brown relative ${ready ? 'animate-glow-pulse' : ''}`} style={{ padding: 0, aspectRatio: '3 / 4' }}>
        <div className="h-full flex flex-col items-center justify-between p-2">
          {/* Sprite */}
          <div className="flex-1 flex items-center justify-center w-full pt-1">
            <img
              src={sprite}
              alt=""
              className="sprite-pixel"
              style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
            />
          </div>
          {/* Status badge */}
          {ready ? (
            <div className="w-full bg-[var(--color-forest-500)] border-2 border-[var(--color-forest-900)] rounded-sm py-0.5 px-1 text-center">
              <p className="font-display font-bold text-[9px] text-white uppercase tracking-wider">Klaar</p>
            </div>
          ) : (
            <div className="w-full bg-[var(--color-night-900)]/85 border border-[var(--color-gold-500)]/50 rounded-sm py-0.5 px-1 text-center">
              <p className="font-display font-bold text-[10px] text-[var(--color-gold-200)] tabular-nums">{fmt(cdLeft)}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
