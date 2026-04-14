'use client';

import Link from 'next/link';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';

// Clash Royale style top HUD: a single slim row across the very top
// of the screen with three rounded chips: coins (left) · level badge
// (middle, optional) · trophies (right). No clutter, no level bar,
// no streak SVG. Settings cog far right.

export default function TopHud() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between"
      style={{
        padding: '8px 10px calc(8px + env(safe-area-inset-top, 0px)) 10px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <Chip value={coins} icon="🪙" tint="gold" />
      <Chip value={trophies} icon="🏆" tint="magic" href="/league" />
    </div>
  );
}

function Chip({
  value,
  icon,
  tint,
  href,
}: {
  value: number;
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
        gap: 8,
        padding: '6px 16px 6px 6px',
        borderRadius: 999,
        background: bg,
        border: '3px solid #0d0a06',
        boxShadow:
          'inset 0 1.5px 0 rgba(255,255,255,0.75), ' +
          'inset 0 -2.5px 0 rgba(0,0,0,0.4), ' +
          '0 3px 0 #0d0a06, ' +
          '0 6px 12px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: '#0d0a06',
          border: `2px solid ${ring}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
          boxShadow: 'inset 0 0 8px rgba(0,0,0,0.6)',
        }}
      >
        {icon}
      </span>
      <span
        className="font-display"
        style={{
          fontSize: 18,
          color: '#2a1505',
          textShadow: '0 1.5px 0 rgba(255,255,255,0.5)',
          letterSpacing: '0.02em',
          lineHeight: 1,
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
