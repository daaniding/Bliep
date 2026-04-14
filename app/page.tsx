'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GameShell from './components/GameShell';
import VideoHeroScene from './components/VideoHeroScene';
import HomeAtmosphere from './components/HomeAtmosphere';
import { getDailyTasks, loadDailyPick, type DailyTask } from '@/lib/dailyTasks';
import { sfxTap } from '@/lib/sound';

// Living 3D kingdom home — a R3F scene fills the entire space between
// the sticky TopHud and the bottom nav. The single primary CTA floats
// over the bottom of the scene. No teaser strip on home (lives in /meer).

export default function Home() {
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks());
  const [pick, setPick] = useState(() => loadDailyPick());

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
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
      <div className="fixed inset-0 flex flex-col">
        {/* === Full-bleed scene: video runs edge-to-edge, HUD + nav
             sit on top via their own fixed positioning === */}
        <div className="relative flex-1 overflow-hidden">
          <VideoHeroScene />
          <HomeAtmosphere />

          {/* === Floating CTA over the scene === */}
          <div
            className="absolute left-0 right-0 px-4 animate-fade-up"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 126px)',
              animationDelay: '120ms',
            }}
          >
            <Link
              href="/opdracht"
              onClick={() => sfxTap()}
              className="block w-full active:scale-[0.97] transition-transform"
              style={{
                padding: '20px 24px',
                borderRadius: 22,
                background:
                  'linear-gradient(180deg, #fff6dc 0%, #fdd069 12%, #f0b840 35%, #c8891e 75%, #8a5a10 100%)',
                border: '4px solid #0d0a06',
                boxShadow:
                  'inset 0 2px 0 rgba(255,255,255,0.85), ' +
                  'inset 0 -3px 0 rgba(90,45,0,0.5), ' +
                  '0 5px 0 #6e4c10, ' +
                  '0 12px 24px rgba(0,0,0,0.7), ' +
                  '0 0 36px rgba(240,184,64,0.7)',
                animation: 'ctaPulse 1.8s ease-in-out infinite',
                textDecoration: 'none',
                minHeight: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 24 }}>⚔</span>
              <span
                className="font-display"
                style={{
                  fontSize: 20,
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
              <span style={{ fontSize: 24 }}>⚔</span>
            </Link>
            {pick.completed && (
              <p
                className="font-body text-center mt-2"
                style={{
                  fontSize: 11,
                  color: '#fdd069',
                  opacity: 0.85,
                  letterSpacing: '0.05em',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                {pick.outcome === 'won'
                  ? '🏆 Vandaag voltooid — kom morgen terug'
                  : '💤 De dag is voorbij — nieuwe opdracht morgen'}
              </p>
            )}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
