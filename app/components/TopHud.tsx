'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';
import { CoinIcon, TrophyIcon, FlameIcon } from './icons/GameIcons';

// Sticky top HUD: coins (left) · streak (centre) · trophies (right).
// Subtle amber glow on chips with value > 0.

export default function TopHud() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const streak = useStreak();

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
      <Chip value={coins.toLocaleString('nl-NL')} icon={<CoinIcon size={22} />} tint="gold" glow={coins > 0} />
      <StreakChip current={streak.current} />
      <Chip value={trophies.toLocaleString('nl-NL')} icon={<TrophyIcon size={22} />} tint="magic" href="/league" glow={trophies > 0} />
    </div>
  );
}

function Chip({
  value,
  icon,
  tint,
  href,
  glow,
}: {
  value: string;
  icon: ReactNode;
  tint: 'gold' | 'magic';
  href?: string;
  glow?: boolean;
}) {
  const goldGradient =
    'linear-gradient(180deg, #fff6dc 0%, #fdd069 18%, #f0b840 45%, #c8891e 80%, #6e4c10 100%)';
  const magicGradient =
    'linear-gradient(180deg, #e0c5ff 0%, #b080e0 18%, #8a4bbf 45%, #5a2e8f 80%, #2a0f3d 100%)';
  const bg = tint === 'gold' ? goldGradient : magicGradient;
  const ring = tint === 'gold' ? '#fdd069' : '#c8a8f0';
  const glowColor = tint === 'gold' ? 'rgba(240, 184, 64, 0.7)' : 'rgba(176, 128, 224, 0.7)';

  const inner = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 18px 8px 8px',
        borderRadius: 999,
        background: bg,
        border: '3.5px solid #0d0a06',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.85), ' +
          'inset 0 -3px 0 rgba(0,0,0,0.45), ' +
          '0 3px 0 #0d0a06, ' +
          '0 7px 14px rgba(0,0,0,0.6)' +
          (glow ? `, 0 0 22px ${glowColor}` : ''),
        pointerEvents: 'auto',
        minHeight: 48,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a1505, #0d0a06)',
          border: `2.5px solid ${ring}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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

function StreakChip({ current }: { current: number }) {
  const active = current > 0;
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        padding: active ? '8px 16px' : '6px 14px',
        borderRadius: 999,
        background: active
          ? 'linear-gradient(180deg, #ff8a3a 0%, #e8541b 35%, #a02810 75%, #4a0c00 100%)'
          : 'linear-gradient(180deg, #2a1a0e 0%, #1a0f05 100%)',
        border: '3px solid #0d0a06',
        boxShadow: active
          ? 'inset 0 1.5px 0 rgba(255,200,100,0.7), inset 0 -2px 0 rgba(0,0,0,0.5), 0 3px 0 #0d0a06, 0 6px 14px rgba(0,0,0,0.6), 0 0 22px rgba(255,140,40,0.65)'
          : 'inset 0 1px 0 rgba(240,184,64,0.35), inset 0 -2px 0 rgba(0,0,0,0.6), 0 2px 0 #0d0a06, 0 4px 8px rgba(0,0,0,0.55)',
        pointerEvents: 'auto',
        minHeight: 48,
      }}
    >
      {active ? (
        <>
          <span
            className="font-display"
            style={{
              fontSize: 16,
              color: '#fff6dc',
              textShadow: '0 1.5px 0 rgba(0,0,0,0.7)',
              letterSpacing: '0.04em',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FlameIcon size={18} />
            {current}
          </span>
          <span
            className="font-display"
            style={{
              fontSize: 8,
              color: '#fff6dc',
              opacity: 0.75,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {current === 1 ? 'dag' : 'dagen'}
          </span>
        </>
      ) : (
        <>
          <span
            className="font-display"
            style={{
              fontSize: 13,
              color: '#fdd069',
              textShadow: '0 1px 0 rgba(0,0,0,0.7)',
              letterSpacing: '0.04em',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FlameIcon size={14} />
            Start streak
          </span>
          <span
            className="font-body"
            style={{
              fontSize: 8,
              color: '#f4e6b8',
              opacity: 0.7,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            vandaag
          </span>
        </>
      )}
    </div>
  );
}
