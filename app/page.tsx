'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GameShell from './components/GameShell';
import CityBanner from './components/CityBanner';
import { getDailyTasks, loadDailyPick, type DailyTask } from '@/lib/dailyTasks';
import { sfxTap } from '@/lib/sound';

// New home — emotional anchor (city banner) at the top, single
// dominant primary CTA in the middle ("Start opdracht van vandaag"),
// teaser strip with army + next-attack at the bottom. Three task
// cards have moved to /opdracht.

export default function Home() {
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Refresh pick state if it changed on another tab/route
    const onFocus = () => setPick(loadDailyPick());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;
  const ctaLabel = pick.completed
    ? 'Bekijk je opdracht'
    : chosenTask
      ? 'Hervat je opdracht'
      : 'Start opdracht van vandaag';

  return (
    <GameShell>
      {/* Page scroll container — TopHud sits sticky above this */}
      <div
        className="flex flex-col w-full"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
          minHeight: '100dvh',
          gap: 18,
        }}
      >
        {/* === Hero: city banner === */}
        <div className="animate-fade-up px-3" style={{ animationDelay: '40ms' }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: '3px solid #0d0a06',
              boxShadow:
                'inset 0 0 0 1.5px rgba(240, 184, 64, 0.5), 0 6px 16px rgba(0, 0, 0, 0.65)',
            }}
          >
            <CityBanner />
          </div>
        </div>

        {/* === Primary CTA === */}
        <div className="animate-fade-up px-4" style={{ animationDelay: '120ms' }}>
          <Link
            href="/opdracht"
            onClick={() => sfxTap()}
            className="block w-full active:scale-[0.97] transition-transform"
            style={{
              padding: '22px 24px',
              borderRadius: 22,
              background:
                'linear-gradient(180deg, #fff6dc 0%, #fdd069 12%, #f0b840 35%, #c8891e 75%, #8a5a10 100%)',
              border: '4px solid #0d0a06',
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.85), ' +
                'inset 0 -3px 0 rgba(90,45,0,0.5), ' +
                '0 5px 0 #6e4c10, ' +
                '0 12px 24px rgba(0,0,0,0.7), ' +
                '0 0 32px rgba(240,184,64,0.6)',
              animation: 'ctaPulse 1.8s ease-in-out infinite',
              textDecoration: 'none',
              minHeight: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 26 }}>⚔</span>
            <span
              className="font-display"
              style={{
                fontSize: 22,
                color: '#2a1505',
                textShadow: '0 1.5px 0 rgba(255,255,255,0.55)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.1,
                textAlign: 'center',
              }}
            >
              {ctaLabel}
            </span>
            <span style={{ fontSize: 26 }}>⚔</span>
          </Link>
          {pick.completed && (
            <p
              className="font-body text-center mt-2"
              style={{ fontSize: 11, color: '#fdd069', opacity: 0.85, letterSpacing: '0.05em' }}
            >
              {pick.outcome === 'won'
                ? '🏆 Vandaag voltooid — kom morgen terug'
                : '💤 De dag is voorbij — nieuwe opdracht morgen'}
            </p>
          )}
        </div>

        {/* === Teaser strip === */}
        <div className="animate-fade-up px-3" style={{ animationDelay: '200ms' }}>
          <div
            className="flex gap-3 overflow-x-auto pb-1"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <TeaserCard
              title="Je leger"
              value="0 troepen"
              hint="Kazerne nog niet gebouwd"
              icon="🛡"
              tint="forest"
            />
            <TeaserCard
              title="Volgende aanval"
              value="2u 14m"
              hint="Tegen wachthuis NPC"
              icon="⚔"
              tint="blood"
            />
          </div>
        </div>
      </div>
    </GameShell>
  );
}

function TeaserCard({
  title,
  value,
  hint,
  icon,
  tint,
}: {
  title: string;
  value: string;
  hint: string;
  icon: string;
  tint: 'forest' | 'blood';
}) {
  const accent = tint === 'forest' ? '#5ea05c' : '#c0392b';
  const accentDeep = tint === 'forest' ? '#2e5c32' : '#7a1f12';
  return (
    <div
      className="flex-shrink-0 panel-dark-glass relative"
      style={{
        scrollSnapAlign: 'start',
        minWidth: 168,
        padding: '12px 14px 12px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: `linear-gradient(180deg, ${accent} 0%, ${accentDeep} 100%)`,
          border: '2.5px solid #0d0a06',
          boxShadow:
            'inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.4), 0 2px 0 #0d0a06',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p
          className="font-display"
          style={{
            fontSize: 9,
            color: '#fdd069',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            lineHeight: 1,
            margin: 0,
          }}
        >
          {title}
        </p>
        <p
          className="font-display"
          style={{
            fontSize: 15,
            color: '#fff6dc',
            textShadow: '0 1.5px 0 #0d0a06',
            lineHeight: 1.1,
            marginTop: 3,
            marginBottom: 0,
          }}
        >
          {value}
        </p>
        <p
          className="font-body"
          style={{
            fontSize: 10,
            color: '#f4e6b8',
            opacity: 0.65,
            lineHeight: 1.15,
            marginTop: 2,
            marginBottom: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 120,
          }}
        >
          {hint}
        </p>
      </div>
    </div>
  );
}
