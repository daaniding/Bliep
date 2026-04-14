'use client';

import Link from 'next/link';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';

// Clash Royale style top HUD: coins (left) · level shield (centre)
// · trophies (right). Bigger painted chips, mini XP bar inside the
// level badge.

function levelForTrophies(t: number) {
  let level = 1;
  let base = 0;
  while (true) {
    const cost = level * 50;
    if (t < base + cost) return { level, base, next: base + cost };
    base += cost;
    level += 1;
  }
}

export default function TopHud() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const { level, base, next } = levelForTrophies(trophies);
  const pct = Math.max(0, Math.min(1, (trophies - base) / (next - base)));

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between"
      style={{
        padding: '10px 12px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <Chip value={coins.toLocaleString('nl-NL')} icon="🪙" tint="gold" />
      <LevelShield level={level} pct={pct} />
      <Chip value={trophies.toLocaleString('nl-NL')} icon="🏆" tint="magic" href="/league" />
    </div>
  );
}

function Chip({
  value,
  icon,
  tint,
  href,
}: {
  value: string;
  icon: string;
  tint: 'gold' | 'magic';
  href?: string;
}) {
  const goldGradient =
    'linear-gradient(180deg, #fff6dc 0%, #fdd069 18%, #f0b840 45%, #c8891e 80%, #6e4c10 100%)';
  const magicGradient =
    'linear-gradient(180deg, #e0c5ff 0%, #b080e0 18%, #8a4bbf 45%, #5a2e8f 80%, #2a0f3d 100%)';
  const bg = tint === 'gold' ? goldGradient : magicGradient;
  const ring = tint === 'gold' ? '#fdd069' : '#c8a8f0';

  const inner = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 20px 8px 8px',
        borderRadius: 999,
        background: bg,
        border: '3.5px solid #0d0a06',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.85), ' +
          'inset 0 -3px 0 rgba(0,0,0,0.45), ' +
          '0 3px 0 #0d0a06, ' +
          '0 7px 14px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a1505, #0d0a06)',
          border: `2.5px solid ${ring}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
          flexShrink: 0,
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        {icon}
      </span>
      <span
        className="font-display"
        style={{
          fontSize: 20,
          color: '#2a1505',
          textShadow: '0 1.5px 0 rgba(255,255,255,0.55)',
          letterSpacing: '0.02em',
          lineHeight: 1,
          minWidth: 14,
        }}
      >
        {value}
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function LevelShield({ level, pct }: { level: number; pct: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        pointerEvents: 'auto',
      }}
    >
      {/* Round shield with level number */}
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 25%, #fff6dc 0%, #fdd069 25%, #c8891e 65%, #6e4c10 100%)',
          border: '3.5px solid #0d0a06',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.7), ' +
            'inset 0 -3px 0 rgba(90,45,0,0.5), ' +
            '0 3px 0 #0d0a06, ' +
            '0 6px 12px rgba(0,0,0,0.65), ' +
            '0 0 18px rgba(240,184,64,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="font-display"
          style={{
            fontSize: 22,
            color: '#2a1505',
            textShadow: '0 1.5px 0 rgba(255,255,255,0.6)',
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      </div>
      {/* Mini XP progress bar */}
      <div
        style={{
          width: 56,
          height: 6,
          borderRadius: 999,
          background: 'linear-gradient(180deg, #0d0a06 0%, #1a0f05 100%)',
          border: '1.5px solid #0d0a06',
          padding: 1,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8), 0 1px 0 rgba(240,184,64,0.5)',
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #ff9060 0%, #c0392b 100%)',
            boxShadow: '0 0 6px rgba(255,140,80,0.7)',
            transition: 'width 0.4s ease-out',
          }}
        />
      </div>
    </div>
  );
}
