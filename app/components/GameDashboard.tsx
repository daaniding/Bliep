'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CityPreview from './CityPreview';
import {
  CoinIcon,
  TrophyIcon,
  FlameIcon,
  ChestIcon,
  LockIcon,
} from './icons/GameIcons';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';
import {
  getDailyTasks,
  loadDailyPick,
  TIER_CONFIG,
  type DailyTask,
  type DailyPick,
} from '@/lib/dailyTasks';
import {
  loadFreeChest,
  msUntilReady,
  isReady as chestReady,
} from '@/lib/freeChest';
import { sfxTap } from '@/lib/sound';

/**
 * GameDashboard — Supercell-grade home screen.
 *
 *  ┌──────────────────────────────┐
 *  │  player banner                │
 *  │  ♦ Uw Rijk ♦ (city frame)     │
 *  │  streak · coins · trophies    │
 *  │  ╔═══════════════════════╗   │
 *  │  ║  DAGELIJKSE OPDRACHT   ║  │  ← hero
 *  │  ║  [tier pill]           ║  │
 *  │  ║  task text             ║  │
 *  │  ║  ⏱ 30 min · 🪙 130     ║  │
 *  │  ║  [ START OPDRACHT ]    ║  │
 *  │  ╚═══════════════════════╝   │
 *  │  chest · chest · chest · chest│
 *  └──────────────────────────────┘
 */

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}u ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const TIER_STYLE: Record<
  'easy' | 'medium' | 'hard',
  { label: string; color: string; glow: string; ring: string }
> = {
  easy:   { label: 'MAKKELIJK', color: '#3d7a3f', glow: 'rgba(94,160,92,0.7)',  ring: '#8cc76c' },
  medium: { label: 'MEDIUM',    color: '#d19225', glow: 'rgba(240,184,64,0.75)', ring: '#fdd069' },
  hard:   { label: 'LASTIG',    color: '#c0392b', glow: 'rgba(230,114,96,0.75)', ring: '#e67260' },
};

export default function GameDashboard() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const streak = useStreak();

  const [displayName, setDisplayName] = useState('Held');
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [pick, setPick] = useState<DailyPick | null>(null);
  const [chestMs, setChestMs] = useState<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem('bliep:displayName');
      if (n && n.trim()) setDisplayName(n.trim());
    } catch { /* ignore */ }

    setTasks(getDailyTasks());
    setPick(loadDailyPick());

    const refresh = () => {
      setChestMs(msUntilReady(loadFreeChest()));
      setPick(loadDailyPick());
    };
    refresh();
    tickRef.current = window.setInterval(refresh, 1000);

    const onFocus = () => setPick(loadDailyPick());
    window.addEventListener('focus', onFocus);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const chosenTask = pick?.chosenId
    ? tasks.find((t) => t.id === pick.chosenId) ?? null
    : null;

  // Coin progress
  const nextMilestone = Math.max(500, (Math.floor(coins / 500) + 1) * 500);
  const prevMilestone = nextMilestone - 500;
  const coinPct = Math.max(
    0,
    Math.min(1, (coins - prevMilestone) / (nextMilestone - prevMilestone)),
  );

  const chestAvailable = chestReady(loadFreeChest());

  // Quest card state
  const questState: 'done' | 'chosen' | 'open' =
    pick?.completed ? 'done' : chosenTask ? 'chosen' : 'open';

  const heroTier = (chosenTask?.tier ?? 'medium') as 'easy' | 'medium' | 'hard';
  const heroTierStyle = TIER_STYLE[heroTier];
  const displayTask = chosenTask ?? tasks[1] ?? tasks[0] ?? null;

  const ctaLabel =
    questState === 'done'
      ? 'Voltooid'
      : questState === 'chosen'
        ? 'Hervat opdracht'
        : 'Kies je opdracht';

  return (
    <div className="gd-root">
      {/* ambient sparkles */}
      <div className="gd-sparkles" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={`gd-sparkle gd-sparkle-${i}`}
            style={{
              left: `${(i * 83) % 100}%`,
              top: `${(i * 47) % 100}%`,
              animationDelay: `${(i * 317) % 4000}ms`,
            }}
          />
        ))}
      </div>

      {/* ===== Player banner ===== */}
      <Link
        href="/meer"
        onClick={() => sfxTap()}
        className="gd-banner animate-fade-up"
        style={{ animationDelay: '40ms' }}
      >
        <div className="gd-banner-avatar">
          <svg viewBox="0 0 36 36" width="36" height="36">
            <circle cx="18" cy="15" r="7" fill="#f0b840" stroke="#1a0f05" strokeWidth="2" />
            <path d="M6 32 Q6 22 18 22 Q30 22 30 32 Z" fill="#c0392b" stroke="#1a0f05" strokeWidth="2" />
            <circle cx="15" cy="15" r="1.1" fill="#1a0f05" />
            <circle cx="21" cy="15" r="1.1" fill="#1a0f05" />
            <path d="M14 18 Q18 20 22 18" stroke="#1a0f05" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gd-banner-body">
          <span className="gd-banner-label">VORST VAN</span>
          <span className="gd-banner-name font-display">{displayName}</span>
        </div>
        <div className="gd-banner-meta">
          <span className="gd-banner-level font-display">LVL 1</span>
          <span className="gd-banner-chevron">›</span>
        </div>
      </Link>

      {/* ===== City frame — picture-frame style ===== */}
      <div
        className="gd-city animate-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        <div className="gd-city-frame">
          <div className="gd-city-header font-display">
            <span className="gd-city-diamond" />
            <span>UW RIJK</span>
            <span className="gd-city-diamond" />
          </div>
          <div className="gd-city-inner">
            <CityPreview />
          </div>
          <div className="gd-city-corner gd-city-corner-tl" />
          <div className="gd-city-corner gd-city-corner-tr" />
          <div className="gd-city-corner gd-city-corner-bl" />
          <div className="gd-city-corner gd-city-corner-br" />
        </div>
      </div>

      {/* ===== Stats row ===== */}
      <div className="gd-stats">
        <div
          className="gd-chip animate-fade-up"
          style={{ animationDelay: '180ms' }}
        >
          <div className="gd-chip-icon gd-chip-icon-flame">
            <FlameIcon size={22} />
          </div>
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">{streak.current}</span>
            <span className="gd-chip-label">streak</span>
          </div>
        </div>

        <div
          className="gd-chip gd-chip-coin animate-fade-up"
          style={{ animationDelay: '240ms' }}
        >
          <div className="gd-chip-icon gd-chip-icon-coin">
            <CoinIcon size={22} />
          </div>
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">
              {coins.toLocaleString('nl-NL')}
            </span>
            <div className="gd-chip-bar">
              <div
                className="gd-chip-bar-fill"
                style={{ width: `${Math.round(coinPct * 100)}%` }}
              />
              <div className="gd-chip-bar-shine" />
            </div>
          </div>
        </div>

        <div
          className="gd-chip animate-fade-up"
          style={{ animationDelay: '300ms' }}
        >
          <div className="gd-chip-icon gd-chip-icon-trophy">
            <TrophyIcon size={22} />
          </div>
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">{trophies}</span>
            <span className="gd-chip-label">trofee</span>
          </div>
        </div>
      </div>

      {/* ===== HERO: Daily Quest card ===== */}
      <Link
        href="/opdracht"
        onClick={() => sfxTap()}
        className={`gd-quest animate-fade-up ${questState === 'done' ? 'gd-quest-done' : ''} ${questState !== 'done' ? 'gd-quest-pulse' : ''}`}
        style={{ animationDelay: '360ms' }}
      >
        <div className="gd-quest-inner">
          <div className="gd-quest-head">
            <span className="gd-quest-eyebrow font-display">
              DAGELIJKSE OPDRACHT
            </span>
            {questState !== 'done' && displayTask && (
              <span
                className="gd-quest-tier font-display"
                style={{
                  background: heroTierStyle.color,
                  borderColor: heroTierStyle.ring,
                  boxShadow: `0 0 14px ${heroTierStyle.glow}, inset 0 1.5px 0 rgba(255,255,255,0.45)`,
                }}
              >
                {heroTierStyle.label}
              </span>
            )}
            {questState === 'done' && (
              <span className="gd-quest-check">✓</span>
            )}
          </div>

          <div className="gd-quest-body">
            {questState === 'done' ? (
              <>
                <p className="gd-quest-text font-display">
                  Vandaag voltooid
                </p>
                <p className="gd-quest-sub font-body">
                  Kom morgen terug voor een nieuwe opdracht
                </p>
              </>
            ) : displayTask ? (
              <>
                <p className="gd-quest-text font-display">
                  {displayTask.text}
                </p>
                <div className="gd-quest-meta">
                  <span className="gd-quest-meta-pill">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                      <circle cx="12" cy="13" r="8" fill="#fdd069" stroke="#1a0f05" strokeWidth="2" />
                      <path d="M12 9 V13 L15 15" stroke="#1a0f05" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <rect x="9" y="3" width="6" height="2" fill="#1a0f05" />
                    </svg>
                    <span className="font-display">{displayTask.durationMin} min</span>
                  </span>
                  <span className="gd-quest-meta-pill">
                    <CoinIcon size={16} />
                    <span className="font-display">+{displayTask.coins}</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="gd-quest-text font-display">Laden…</p>
            )}
          </div>

          <div
            className={`gd-quest-cta font-display ${questState === 'done' ? 'gd-quest-cta-done' : ''}`}
          >
            <span className="gd-quest-cta-label">{ctaLabel}</span>
            {questState !== 'done' && (
              <span className="gd-quest-cta-arrow">›</span>
            )}
          </div>
        </div>
      </Link>

      {/* ===== Chest slots ===== */}
      <div
        className="gd-chests animate-fade-up"
        style={{ animationDelay: '480ms' }}
      >
        {[0, 1, 2, 3].map((i) => {
          const isFirst = i === 0;
          const active = isFirst && chestAvailable;
          return (
            <Link
              key={i}
              href={isFirst ? '/opdracht' : '/battle'}
              onClick={(e) => {
                if (!isFirst) e.preventDefault();
                sfxTap();
              }}
              className={`gd-chest ${active ? 'gd-chest-ready' : ''} ${!isFirst ? 'gd-chest-locked' : ''}`}
              aria-label={isFirst ? 'Gratis kist' : 'Kist-slot vergrendeld'}
            >
              <div className="gd-chest-art">
                <ChestIcon size={38} />
                {!isFirst && (
                  <span className="gd-chest-lock">
                    <LockIcon size={20} />
                  </span>
                )}
              </div>
              <span className="gd-chest-caption font-display">
                {isFirst
                  ? active
                    ? 'GRATIS'
                    : formatMs(chestMs)
                  : `#${i + 1}`}
              </span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .gd-root {
          position: relative;
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px
            calc(env(safe-area-inset-bottom, 0px) + 140px);
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        /* ===== Sparkles ===== */
        .gd-sparkles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .gd-sparkle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 244, 180, 1) 0%,
            rgba(255, 220, 140, 0.6) 40%,
            rgba(255, 220, 140, 0) 100%
          );
          box-shadow: 0 0 6px rgba(255, 220, 140, 0.9);
          animation: sparkleTwinkle 4s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          40%, 60% { opacity: 0.9; transform: scale(1.2); }
        }

        /* ===== Banner ===== */
        .gd-banner {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px 9px 9px;
          border-radius: 18px;
          background: linear-gradient(180deg, #3d2410 0%, #2a1a0e 45%, #1a0f05 100%);
          border: 3px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(253, 208, 105, 0.55),
            inset 0 -2.5px 0 rgba(0, 0, 0, 0.75),
            inset 0 0 0 1px rgba(240, 184, 64, 0.25),
            0 4px 0 #0d0a06,
            0 8px 18px rgba(0, 0, 0, 0.6);
          text-decoration: none;
          overflow: hidden;
          transition: transform 120ms ease-out;
        }
        .gd-banner:active {
          transform: scale(0.98);
        }
        .gd-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            rgba(240, 184, 64, 0) 30%,
            rgba(255, 220, 140, 0.14) 50%,
            rgba(240, 184, 64, 0) 70%
          );
          pointer-events: none;
        }
        .gd-banner::after {
          content: '';
          position: absolute;
          inset: 3px;
          border-radius: 15px;
          border: 1px solid rgba(240, 184, 64, 0.35);
          pointer-events: none;
        }
        .gd-banner-avatar {
          position: relative;
          flex: 0 0 auto;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #3d2410 0%, #1a0f05 70%);
          border: 3px solid #fdd069;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            inset 0 0 12px rgba(0, 0, 0, 0.8),
            inset 0 2px 0 rgba(255, 246, 220, 0.4),
            0 2px 0 #0d0a06,
            0 0 14px rgba(240, 184, 64, 0.45);
        }
        .gd-banner-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .gd-banner-label {
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #fdd069;
          opacity: 0.8;
          text-transform: uppercase;
          font-weight: 700;
          text-shadow: 0 1px 0 #0d0a06;
        }
        .gd-banner-name {
          font-size: 20px;
          color: #fff6dc;
          text-shadow:
            0 1.5px 0 #0d0a06,
            0 0 12px rgba(240, 184, 64, 0.35);
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.05;
        }
        .gd-banner-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          padding-right: 2px;
        }
        .gd-banner-level {
          font-size: 10px;
          letter-spacing: 0.12em;
          color: #0d0a06;
          background: linear-gradient(180deg, #fdd069, #c8891e);
          padding: 3px 8px;
          border-radius: 999px;
          border: 1.5px solid #0d0a06;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            0 1.5px 0 #0d0a06;
        }
        .gd-banner-chevron {
          color: #fdd069;
          font-size: 24px;
          font-family: var(--font-display), system-ui, sans-serif;
          text-shadow: 0 1.5px 0 #0d0a06;
          line-height: 1;
          opacity: 0.8;
        }

        /* ===== City frame ===== */
        .gd-city {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .gd-city-frame {
          position: relative;
          width: 100%;
          max-width: 400px;
          padding: 5px;
          border-radius: 22px;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #fdd069 12%,
            #c8891e 40%,
            #6e4c10 75%,
            #2a1505 100%
          );
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.6),
            inset 0 -2px 0 rgba(0, 0, 0, 0.5),
            0 5px 0 #0d0a06,
            0 12px 26px rgba(0, 0, 0, 0.7);
        }
        .gd-city-header {
          position: absolute;
          top: -11px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 16px;
          background: linear-gradient(180deg, #fdd069 0%, #c8891e 100%);
          border: 2.5px solid #0d0a06;
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 0.2em;
          color: #2a1505;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(255, 246, 220, 0.7);
          z-index: 4;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.75),
            inset 0 -1.5px 0 rgba(60, 20, 0, 0.5),
            0 3px 0 #0d0a06,
            0 6px 10px rgba(0, 0, 0, 0.5);
        }
        .gd-city-diamond {
          width: 7px;
          height: 7px;
          background: #0d0a06;
          transform: rotate(45deg);
          box-shadow: 0 0 4px rgba(253, 208, 105, 0.8);
        }
        .gd-city-inner {
          position: relative;
          border-radius: 17px;
          overflow: hidden;
          border: 2.5px solid #0d0a06;
          background: linear-gradient(180deg, #12213f 0%, #0b1630 55%, #060c1f 100%);
          box-shadow:
            inset 0 0 0 1px rgba(240, 184, 64, 0.45),
            inset 0 3px 10px rgba(0, 0, 0, 0.75);
          padding: 12px 6px 2px;
          max-height: 190px;
        }
        .gd-city-inner > :global(*) { max-height: 100%; }
        .gd-city-inner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 90% 60% at 50% 0%,
            rgba(255, 220, 140, 0.15) 0%,
            rgba(255, 220, 140, 0) 70%
          );
          pointer-events: none;
          z-index: 1;
        }
        .gd-city-corner {
          position: absolute;
          width: 18px;
          height: 18px;
          background: radial-gradient(circle at 50% 50%, #fdd069 0%, #8a5a10 100%);
          border: 2px solid #0d0a06;
          border-radius: 50%;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.7),
            0 1.5px 0 #0d0a06;
          z-index: 5;
        }
        .gd-city-corner-tl { top: -5px; left: -5px; }
        .gd-city-corner-tr { top: -5px; right: -5px; }
        .gd-city-corner-bl { bottom: -5px; left: -5px; }
        .gd-city-corner-br { bottom: -5px; right: -5px; }
        .gd-city-inner > :global(.city-preview) {
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
        }
        /* kill the inner CityPreview's own card frame since we wrap it */
        .gd-city-inner :global(.city-preview .card) {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .gd-city-inner :global(.city-preview .card-inner) {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .gd-city-inner :global(.city-preview .card-header),
        .gd-city-inner :global(.city-preview .card-footer) {
          display: none !important;
        }
        .gd-city-inner :global(.city-preview) {
          max-width: 240px !important;
        }

        /* ===== Stats ===== */
        .gd-stats {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 8px;
        }
        .gd-chip {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px 8px 8px;
          border-radius: 16px;
          background: linear-gradient(180deg, #3d2410 0%, #2a1a0e 45%, #1a0f05 100%);
          border: 3px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(253, 208, 105, 0.45),
            inset 0 -2px 0 rgba(0, 0, 0, 0.75),
            inset 0 0 0 1px rgba(240, 184, 64, 0.2),
            0 4px 0 #0d0a06,
            0 6px 12px rgba(0, 0, 0, 0.5);
          min-height: 56px;
          overflow: hidden;
        }
        .gd-chip::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(
            180deg,
            rgba(255, 246, 220, 0.14) 0%,
            rgba(255, 246, 220, 0) 100%
          );
          pointer-events: none;
          border-radius: 13px 13px 0 0;
        }
        .gd-chip-icon {
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 32% 28%, #2a1505 0%, #0d0a06 80%);
          border: 2.5px solid #fdd069;
          box-shadow:
            inset 0 0 10px rgba(0, 0, 0, 0.9),
            inset 0 1.5px 0 rgba(255, 246, 220, 0.3),
            0 1.5px 0 #0d0a06;
        }
        .gd-chip-icon-flame { border-color: #ff8a3a; box-shadow: inset 0 0 10px rgba(0,0,0,0.9), inset 0 1.5px 0 rgba(255,200,140,0.4), 0 1.5px 0 #0d0a06, 0 0 12px rgba(255,138,58,0.55); }
        .gd-chip-icon-coin  { border-color: #fdd069; }
        .gd-chip-icon-trophy{ border-color: #fdd069; }
        .gd-chip-body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          flex: 1;
        }
        .gd-chip-value {
          font-size: 18px;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0a06, 0 0 10px rgba(240, 184, 64, 0.35);
          line-height: 1;
        }
        .gd-chip-label {
          font-size: 8.5px;
          letter-spacing: 0.08em;
          color: #fdd069;
          opacity: 0.8;
          text-transform: uppercase;
          margin-top: 4px;
          text-shadow: 0 1px 0 #0d0a06;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gd-chip-bar {
          position: relative;
          height: 7px;
          border-radius: 4px;
          background: #0d0a06;
          border: 1.5px solid #0d0a06;
          box-shadow:
            inset 0 2px 3px rgba(0, 0, 0, 0.9),
            0 1px 0 rgba(255, 255, 255, 0.08);
          margin-top: 5px;
          overflow: hidden;
        }
        .gd-chip-bar-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #fdd069 30%,
            #f0b840 70%,
            #c8891e 100%
          );
          box-shadow: 0 0 10px rgba(240, 184, 64, 0.9);
          transition: width 400ms ease-out;
        }
        .gd-chip-bar-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.5) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-100%);
          animation: barShine 4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes barShine {
          0%, 80% { transform: translateX(-100%); }
          95%, 100% { transform: translateX(100%); }
        }

        /* ===== Quest hero ===== */
        .gd-quest {
          position: relative;
          display: block;
          text-decoration: none;
          padding: 4px;
          border-radius: 24px;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #fdd069 10%,
            #f0b840 30%,
            #8a5a10 70%,
            #2a1505 100%
          );
          border: 4px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.8),
            inset 0 -3px 0 rgba(60, 20, 0, 0.6),
            0 6px 0 #0d0a06,
            0 14px 26px rgba(0, 0, 0, 0.7),
            0 0 30px rgba(240, 184, 64, 0.45);
          transition: transform 120ms ease-out;
        }
        .gd-quest:active {
          transform: scale(0.97) translateY(2px);
        }
        .gd-quest-pulse {
          animation: questPulse 2.2s ease-in-out infinite;
        }
        @keyframes questPulse {
          0%, 100% {
            box-shadow:
              inset 0 2px 0 rgba(255, 255, 255, 0.8),
              inset 0 -3px 0 rgba(60, 20, 0, 0.6),
              0 6px 0 #0d0a06,
              0 14px 26px rgba(0, 0, 0, 0.7),
              0 0 28px rgba(240, 184, 64, 0.45);
          }
          50% {
            box-shadow:
              inset 0 2px 0 rgba(255, 255, 255, 0.8),
              inset 0 -3px 0 rgba(60, 20, 0, 0.6),
              0 6px 0 #0d0a06,
              0 14px 28px rgba(0, 0, 0, 0.7),
              0 0 48px rgba(255, 210, 100, 0.85);
          }
        }
        .gd-quest-inner {
          position: relative;
          padding: 12px 14px 12px;
          border-radius: 19px;
          background: linear-gradient(
            180deg,
            #213f6f 0%,
            #13284d 40%,
            #091530 100%
          );
          border: 2px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(240, 184, 64, 0.45),
            inset 0 -3px 0 rgba(0, 0, 0, 0.85),
            inset 0 0 0 1px rgba(240, 184, 64, 0.2);
          overflow: hidden;
        }
        .gd-quest-inner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 90% 60% at 50% 0%,
            rgba(255, 220, 140, 0.22) 0%,
            rgba(255, 220, 140, 0) 70%
          );
          pointer-events: none;
        }
        .gd-quest-done .gd-quest-inner {
          background: linear-gradient(180deg, #1e4a26 0%, #0f2a14 100%);
        }
        .gd-quest-head {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .gd-quest-eyebrow {
          font-size: 11px;
          letter-spacing: 0.22em;
          color: #fdd069;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 #0d0a06;
        }
        .gd-quest-tier {
          font-size: 10px;
          letter-spacing: 0.14em;
          color: #fff6dc;
          padding: 4px 10px;
          border-radius: 999px;
          border: 2px solid;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 rgba(0, 0, 0, 0.7);
          line-height: 1;
        }
        .gd-quest-check {
          font-size: 22px;
          color: #8cc76c;
          text-shadow: 0 2px 0 #0d0a06, 0 0 14px rgba(140, 199, 108, 0.8);
          font-family: var(--font-display), system-ui, sans-serif;
          line-height: 1;
        }
        .gd-quest-body {
          position: relative;
        }
        .gd-quest-text {
          font-size: 17px;
          line-height: 1.25;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0a06;
          min-height: 42px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .gd-quest-sub {
          font-size: 12px;
          color: #fdd069;
          opacity: 0.8;
          margin-top: 4px;
        }
        .gd-quest-meta {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .gd-quest-meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 999px;
          background: linear-gradient(180deg, #0d0a06 0%, #1a0f05 100%);
          border: 2px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(240, 184, 64, 0.55),
            inset 0 -1px 0 rgba(0, 0, 0, 0.9),
            0 1.5px 0 #0d0a06;
          font-size: 12px;
          color: #fff6dc;
          text-shadow: 0 1px 0 #0d0a06;
        }
        .gd-quest-cta {
          position: relative;
          margin-top: 10px;
          padding: 11px 16px;
          border-radius: 14px;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 15%, #f0b840 45%, #8a5a10 100%);
          border: 3px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.9),
            inset 0 -3px 0 rgba(60, 20, 0, 0.5),
            0 4px 0 #3d2410,
            0 8px 16px rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .gd-quest-cta-done {
          background: linear-gradient(180deg, #d8e9c0 0%, #8cc76c 15%, #5ea05c 45%, #1e4a26 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.75),
            inset 0 -3px 0 rgba(0, 40, 10, 0.55),
            0 4px 0 #0d2a12,
            0 8px 16px rgba(0, 0, 0, 0.55);
        }
        .gd-quest-cta-label {
          font-size: 17px;
          letter-spacing: 0.08em;
          color: #2a1505;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 rgba(255, 246, 220, 0.65);
          line-height: 1;
        }
        .gd-quest-cta-done .gd-quest-cta-label {
          color: #0d2a12;
          text-shadow: 0 1.5px 0 rgba(255, 255, 255, 0.5);
        }
        .gd-quest-cta-arrow {
          font-family: var(--font-display), system-ui, sans-serif;
          font-size: 24px;
          color: #2a1505;
          text-shadow: 0 1.5px 0 rgba(255, 246, 220, 0.65);
          line-height: 1;
        }

        /* ===== Chests ===== */
        .gd-chests {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .gd-chest {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 4px 7px;
          border-radius: 14px;
          background: linear-gradient(180deg, #3d2410 0%, #2a1a0e 40%, #1a0f05 100%);
          border: 3px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(253, 208, 105, 0.4),
            inset 0 -2px 0 rgba(0, 0, 0, 0.75),
            inset 0 0 0 1px rgba(240, 184, 64, 0.18),
            0 4px 0 #0d0a06,
            0 6px 10px rgba(0, 0, 0, 0.55);
          text-decoration: none;
          min-height: 78px;
          overflow: hidden;
          transition: transform 120ms ease-out;
        }
        .gd-chest::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 45%;
          background: linear-gradient(180deg, rgba(255, 246, 220, 0.12), rgba(255, 246, 220, 0));
          pointer-events: none;
        }
        .gd-chest:active {
          transform: scale(0.95);
        }
        .gd-chest-art {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
        }
        .gd-chest-locked .gd-chest-art :global(svg) {
          opacity: 0.45;
        }
        .gd-chest-lock {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
        }
        .gd-chest-ready {
          background: linear-gradient(180deg, #5c3a1e 0%, #3d2410 50%, #1a0f05 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 220, 140, 0.7),
            inset 0 -2px 0 rgba(0, 0, 0, 0.75),
            inset 0 0 0 1px rgba(253, 208, 105, 0.5),
            0 4px 0 #0d0a06,
            0 6px 10px rgba(0, 0, 0, 0.55),
            0 0 22px rgba(240, 184, 64, 0.75);
          animation: chestShake 4s ease-in-out infinite;
        }
        .gd-chest-caption {
          font-size: 10px;
          color: #fdd069;
          letter-spacing: 0.12em;
          text-shadow: 0 1px 0 #0d0a06;
          text-transform: uppercase;
          line-height: 1;
        }
        .gd-chest-ready .gd-chest-caption {
          color: #fff6dc;
          text-shadow: 0 1px 0 #0d0a06, 0 0 8px rgba(240, 184, 64, 0.8);
        }

        /* ===== Animations ===== */
        @keyframes chestShake {
          0%, 88%, 100% { transform: translateX(0) rotate(0deg); }
          90%           { transform: translateX(-2px) rotate(-3deg); }
          92%           { transform: translateX(2px) rotate(3deg); }
          94%           { transform: translateX(-2px) rotate(-2deg); }
          96%           { transform: translateX(2px) rotate(2deg); }
        }
        .animate-fade-up {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 520ms ease-out forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
