'use client';

import { useEffect, useState } from 'react';
import { loadFreeChest, msUntilReady, isReady, claimFreeChest } from '@/lib/freeChest';
import { useCoins } from '@/lib/useCoins';
import { sfxClaim } from '@/lib/sound';

function fmt(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}u ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

export default function FreeChestStrip() {
  const [state, setState] = useState(() => loadFreeChest());
  const [, setNow] = useState(Date.now());
  const { award } = useCoins();
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setState(loadFreeChest());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const ready = isReady(state);
  const remaining = msUntilReady(state);

  function handleClaim() {
    const result = claimFreeChest();
    if (!result) return;
    sfxClaim();
    award(result.reward);
    setFlash(result.reward);
    setState(loadFreeChest());
    window.setTimeout(() => setFlash(null), 2200);
  }

  return (
    <button
      onClick={handleClaim}
      disabled={!ready}
      className="relative block w-full active:scale-[0.98] transition-transform"
      style={{ background: 'transparent', border: 0, padding: 0, cursor: ready ? 'pointer' : 'default' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 12,
          border: '2px solid #0d0a06',
          background: ready
            ? 'linear-gradient(180deg, #fdd069 0%, #d19225 60%, #7a4f2a 100%)'
            : 'linear-gradient(180deg, rgba(40, 30, 20, 0.85) 0%, rgba(20, 14, 8, 0.9) 100%)',
          boxShadow: ready
            ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 0 #6e4c10, 0 6px 14px rgba(0,0,0,0.55), 0 0 20px rgba(240, 184, 64, 0.55)'
            : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 0 #0d0a06, 0 4px 8px rgba(0,0,0,0.55)',
        }}
      >
        {/* Chest SVG */}
        <svg width="34" height="30" viewBox="0 0 34 30" style={{ flexShrink: 0, filter: ready ? 'drop-shadow(0 0 6px rgba(255, 220, 100, 0.7))' : 'grayscale(0.4)' }}>
          <defs>
            <linearGradient id="chestBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c68e52" />
              <stop offset="1" stopColor="#5c3a1e" />
            </linearGradient>
            <linearGradient id="chestLid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d19a5c" />
              <stop offset="1" stopColor="#7a4f2a" />
            </linearGradient>
          </defs>
          {/* Body */}
          <rect x="4" y="12" width="26" height="14" fill="url(#chestBody)" stroke="#0d0a06" strokeWidth="2" />
          {/* Lid */}
          <path d="M3 12 Q3 4 17 4 Q31 4 31 12 Z" fill="url(#chestLid)" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          {/* Iron bands */}
          <line x1="17" y1="4" x2="17" y2="26" stroke="#0d0a06" strokeWidth="2" />
          <rect x="15" y="12" width="4" height="4" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.2" />
          <line x1="4" y1="18" x2="30" y2="18" stroke="#0d0a06" strokeWidth="1.5" opacity="0.7" />
        </svg>

        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: 11, color: ready ? '#2a1505' : '#c0b090', textShadow: ready ? '0 1px 0 rgba(255,255,255,0.35)' : undefined, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ready ? 'Gratis kist klaar!' : 'Gratis kist'}
          </p>
          <p className="font-display" style={{ fontSize: 14, color: ready ? '#0d0a06' : '#fff6dc', textShadow: ready ? '0 1px 0 rgba(255,255,255,0.45)' : '0 1px 0 rgba(0,0,0,0.5)' }}>
            {ready ? 'Tap om te claimen' : fmt(remaining)}
          </p>
        </div>

        {ready && <span className="text-xl gem-glow-gold">🪙</span>}
      </div>

      {flash !== null && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            fontFamily: 'Lilita One, sans-serif',
            fontSize: 28,
            color: '#fdd069',
            WebkitTextStroke: '2px #0d0a06',
            paintOrder: 'stroke fill',
            textShadow: '0 3px 0 #0d0a06, 0 0 24px rgba(255,200,80,0.8)',
            animation: 'chestFloat 2s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          +{flash} 🪙
        </div>
      )}
    </button>
  );
}
