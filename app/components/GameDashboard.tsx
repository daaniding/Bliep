'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import CityPreview from './CityPreview';
import {
  CoinIcon,
  TrophyIcon,
  FlameIcon,
  LockIcon,
} from './icons/GameIcons';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';
import {
  getDailyTasks,
  loadDailyPick,
  type DailyTask,
  type DailyPick,
} from '@/lib/dailyTasks';
import {
  loadFreeChest,
  msUntilReady,
  isReady as chestReady,
} from '@/lib/freeChest';
import { loadCity } from '@/lib/cityStore';
import { sfxTap } from '@/lib/sound';

/**
 * GameDashboard — Supercell-grade home:
 *
 *   banner (rank · name · level)
 *   fullscreen draggable city (no frame)
 *   streak · coins · trophies
 *   daily quest hero
 *   vervalt-over countdown
 *   chest slots
 */

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}u ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function msUntilAmsterdamMidnight(): number {
  // Compute "now in Amsterdam" without pulling in a tz library.
  const now = new Date();
  const nowAms = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }),
  );
  const end = new Date(nowAms);
  end.setHours(24, 0, 0, 0);
  return end.getTime() - nowAms.getTime();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}u ${m}m`;
  return `${m}m`;
}

type Rank = { label: string; color: string; ringColor: string; minTrophies: number };
const RANKS: Rank[] = [
  { label: 'BRONS',  color: '#9b6838', ringColor: '#d19225', minTrophies: 0 },
  { label: 'ZILVER', color: '#b8c0c8', ringColor: '#e8edf2', minTrophies: 100 },
  { label: 'GOUD',   color: '#f0b840', ringColor: '#fff6dc', minTrophies: 500 },
];
function getRank(trophies: number): Rank {
  return [...RANKS].reverse().find((r) => trophies >= r.minTrophies) ?? RANKS[0];
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
  const [dayMs, setDayMs] = useState<number>(0);
  const [buildingCount, setBuildingCount] = useState(1);
  const tickRef = useRef<number | null>(null);

  // ===== City rotation state =====
  const [cityRotation, setCityRotation] = useState(0); // degrees
  const dragRef = useRef<{ startX: number; startRot: number; dragging: boolean }>({
    startX: 0,
    startRot: 0,
    dragging: false,
  });
  const [dragging, setDragging] = useState(false);

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
      setDayMs(msUntilAmsterdamMidnight());
      const city = loadCity();
      setBuildingCount(Math.max(1, city.buildings.length));
    };
    refresh();
    tickRef.current = window.setInterval(refresh, 1000);

    const onFocus = () => refresh();
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

  const freeChestAvailable = chestReady(loadFreeChest());

  // Quest card state
  const questState: 'done' | 'chosen' | 'open' =
    pick?.completed ? 'done' : chosenTask ? 'chosen' : 'open';
  const questPending = questState !== 'done';

  const heroTier = (chosenTask?.tier ?? 'medium') as 'easy' | 'medium' | 'hard';
  const heroTierStyle = TIER_STYLE[heroTier];
  const displayTask = chosenTask ?? tasks[1] ?? tasks[0] ?? null;

  const ctaLabel =
    questState === 'done'
      ? 'Voltooid'
      : questState === 'chosen'
        ? 'Hervat opdracht'
        : 'Kies je opdracht';

  // Rank + level
  const rank = useMemo(() => getRank(trophies), [trophies]);
  const level = buildingCount;

  // Countdown urgency
  const urgent = dayMs > 0 && dayMs < 2 * 60 * 60 * 1000;

  const coinsOverflow = coins > 100;

  // ===== Drag handlers =====
  const onTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    dragRef.current.startX = e.touches[0].clientX;
    dragRef.current.startRot = cityRotation;
    dragRef.current.dragging = true;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.dragging || !e.touches[0]) return;
    const dx = e.touches[0].clientX - dragRef.current.startX;
    const next = dragRef.current.startRot + dx * 0.35;
    setCityRotation(Math.max(-35, Math.min(35, next)));
  };
  const onTouchEnd = () => {
    dragRef.current.dragging = false;
    setDragging(false);
  };
  // Also allow mouse drag for desktop preview
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current.startX = e.clientX;
    dragRef.current.startRot = cityRotation;
    dragRef.current.dragging = true;
    setDragging(true);
    const move = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const next = dragRef.current.startRot + dx * 0.35;
      setCityRotation(Math.max(-35, Math.min(35, next)));
    };
    const up = () => {
      dragRef.current.dragging = false;
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="gd-root">
      {/* ambient sparkles */}
      <div className="gd-sparkles" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="gd-sparkle"
            style={{
              left: `${(i * 83 + 11) % 100}%`,
              top: `${(i * 47 + 7) % 100}%`,
              animationDelay: `${(i * 317) % 5000}ms`,
              animationDuration: `${5 + ((i * 131) % 3000) / 1000}s`,
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
        <div className="gd-banner-rank" style={{ '--rank-col': rank.color, '--rank-ring': rank.ringColor } as React.CSSProperties}>
          <svg viewBox="0 0 40 40" width="40" height="40">
            <defs>
              <radialGradient id="rank-grad" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#fff6dc" />
                <stop offset="55%" stopColor={rank.ringColor} />
                <stop offset="100%" stopColor={rank.color} />
              </radialGradient>
            </defs>
            {/* crest shield */}
            <path
              d="M20 3 L34 7 L34 20 Q34 30 20 37 Q6 30 6 20 L6 7 Z"
              fill="url(#rank-grad)"
              stroke="#0d0a06"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M20 7 L30 10 L30 20 Q30 27 20 33 Q10 27 10 20 L10 10 Z"
              fill={rank.color}
              stroke="#0d0a06"
              strokeWidth="1.4"
            />
            {/* star */}
            <path
              d="M20 13 L22 18 L27 18 L23 21 L24.5 26 L20 23 L15.5 26 L17 21 L13 18 L18 18 Z"
              fill="#fff6dc"
              stroke="#0d0a06"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="gd-banner-body">
          <span className="gd-banner-rank-label font-display" style={{ color: rank.ringColor }}>
            {rank.label}
          </span>
          <span className="gd-banner-name font-display">{displayName}</span>
        </div>
        <div className="gd-banner-level">
          <div className="gd-level-badge">
            <span className="gd-level-label font-display">LVL</span>
            <span className="gd-level-num font-display">{level}</span>
          </div>
        </div>
      </Link>

      {/* ===== FULLSCREEN CITY (edge-to-edge) ===== */}
      <div className="gd-city animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div
          className={`gd-city-stage ${dragging ? 'gd-dragging' : ''}`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onMouseDown={onMouseDown}
          style={{
            transform: `rotateY(${cityRotation}deg)`,
          }}
        >
          <CityPreview />
        </div>

        {/* coins overflow badge — subtle arrow to /stad */}
        {coinsOverflow && (
          <Link
            href="/stad"
            onClick={() => sfxTap()}
            className="gd-build-hint"
            aria-label="Bouw iets in je stad"
          >
            <span className="gd-build-hint-dot" />
            <span className="gd-build-hint-label font-display">BOUW IETS</span>
            <span className="gd-build-hint-arrow">›</span>
          </Link>
        )}
      </div>

      {/* ===== Stats row ===== */}
      <div className="gd-stats">
        <div className="gd-chip animate-fade-up" style={{ animationDelay: '180ms' }}>
          <div className="gd-chip-icon gd-chip-icon-flame">
            <FlameIcon size={22} />
          </div>
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">{streak.current}</span>
            <span className="gd-chip-label">streak</span>
          </div>
        </div>

        <div className="gd-chip gd-chip-coin animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="gd-chip-icon gd-chip-icon-coin">
            <CoinIcon size={22} />
          </div>
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">
              {coins.toLocaleString('nl-NL')}
            </span>
            <div className="gd-chip-bar">
              <div className="gd-chip-bar-fill" style={{ width: `${Math.round(coinPct * 100)}%` }} />
              <div className="gd-chip-bar-shine" />
            </div>
          </div>
        </div>

        <div className="gd-chip animate-fade-up" style={{ animationDelay: '300ms' }}>
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
        className={`gd-quest animate-fade-up ${questState === 'done' ? 'gd-quest-done' : ''} ${questPending ? 'gd-quest-pulse' : ''}`}
        style={{ animationDelay: '360ms' }}
      >
        {questPending && <span className="gd-quest-badge" aria-hidden />}
        <div className="gd-quest-inner">
          <div className="gd-quest-head">
            <span className="gd-quest-eyebrow font-display">DAGELIJKSE OPDRACHT</span>
            {questPending && displayTask && (
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
            {!questPending && <span className="gd-quest-check">✓</span>}
          </div>

          <div className="gd-quest-body">
            {questState === 'done' ? (
              <>
                <p className="gd-quest-text font-display">Vandaag voltooid</p>
                <p className="gd-quest-sub font-body">
                  Kom morgen terug voor een nieuwe opdracht
                </p>
              </>
            ) : displayTask ? (
              <>
                <p className="gd-quest-text font-display">{displayTask.text}</p>
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

          <div className={`gd-quest-cta font-display ${questState === 'done' ? 'gd-quest-cta-done' : ''}`}>
            <span className="gd-quest-cta-label">{ctaLabel}</span>
            {questPending && <span className="gd-quest-cta-arrow">›</span>}
          </div>
        </div>
      </Link>

      {/* ===== Countdown bar ===== */}
      <div
        className={`gd-countdown animate-fade-up ${urgent ? 'gd-countdown-urgent' : ''}`}
        style={{ animationDelay: '440ms' }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12 9 V13 L15 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <rect x="9" y="3" width="6" height="2" fill="currentColor" />
        </svg>
        <span className="font-display">
          {questState === 'done'
            ? 'Nieuwe opdracht over'
            : 'Vervalt over'}{' '}
          {formatCountdown(dayMs)}
        </span>
      </div>

      {/* ===== Chest slots ===== */}
      <div className="gd-chests animate-fade-up" style={{ animationDelay: '520ms' }}>
        {[0, 1, 2, 3].map((i) => {
          const isFirst = i === 0;
          const active = isFirst && freeChestAvailable;
          return (
            <Link
              key={i}
              href={isFirst ? '/opdracht' : '/battle'}
              onClick={(e) => {
                if (!isFirst) e.preventDefault();
                sfxTap();
              }}
              className={`gd-chest ${active ? 'gd-chest-ready' : ''} ${!isFirst ? 'gd-chest-locked' : ''}`}
              aria-label={isFirst ? 'Gratis kist' : 'Kist-slot vergrendeld — win via battle'}
            >
              {active && <span className="gd-chest-badge" aria-hidden />}
              <div className="gd-chest-art">
                <BigChest variant={isFirst ? 'wood' : 'stone'} />
                {!isFirst && (
                  <span className="gd-chest-lock">
                    <LockIcon size={22} />
                  </span>
                )}
              </div>
              <span className="gd-chest-caption font-display">
                {isFirst
                  ? active
                    ? 'GRATIS'
                    : formatMs(chestMs)
                  : 'BATTLE'}
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
          gap: 10px;
        }

        /* ===== Sparkles ===== */
        .gd-sparkles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
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
          animation: sparkleDrift 6s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes sparkleDrift {
          0%, 100% { opacity: 0; transform: translate(0, 0) scale(0.5); }
          35%, 65% { opacity: 0.9; transform: translate(4px, -6px) scale(1.2); }
        }

        /* ===== Banner ===== */
        .gd-banner {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 7px 11px 7px 8px;
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
          z-index: 1;
        }
        .gd-banner:active { transform: scale(0.98); }
        .gd-banner::before {
          content: '';
          position: absolute;
          inset: 3px;
          border-radius: 15px;
          border: 1px solid rgba(240, 184, 64, 0.35);
          pointer-events: none;
        }
        .gd-banner-rank {
          position: relative;
          flex: 0 0 auto;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.8))
                  drop-shadow(0 0 12px var(--rank-col, #f0b840));
        }
        .gd-banner-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .gd-banner-rank-label {
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 #0d0a06;
        }
        .gd-banner-name {
          font-size: 20px;
          color: #fff6dc;
          text-shadow:
            0 2px 0 #0d0a06,
            0 0 14px rgba(240, 184, 64, 0.4);
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.05;
        }
        .gd-banner-level {
          flex: 0 0 auto;
        }
        .gd-level-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 20%, #f0b840 60%, #8a5a10 100%);
          border: 2.5px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.85),
            inset 0 -2px 0 rgba(60, 20, 0, 0.55),
            0 2.5px 0 #0d0a06,
            0 5px 10px rgba(0, 0, 0, 0.55),
            0 0 14px rgba(240, 184, 64, 0.55);
          padding: 2px 4px;
        }
        .gd-level-label {
          font-size: 8px;
          letter-spacing: 0.16em;
          color: #2a1505;
          text-shadow: 0 1px 0 rgba(255, 246, 220, 0.75);
          line-height: 1;
        }
        .gd-level-num {
          font-size: 20px;
          color: #2a1505;
          text-shadow: 0 1.5px 0 rgba(255, 246, 220, 0.8);
          line-height: 1;
          margin-top: 1px;
        }

        /* ===== Fullscreen city ===== */
        .gd-city {
          position: relative;
          width: calc(100% + 28px);
          margin: 0 -14px;
          height: 26vh;
          min-height: 170px;
          max-height: 230px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          perspective: 900px;
          z-index: 1;
        }
        .gd-city::before {
          content: '';
          position: absolute;
          inset: -20px 0 -10px;
          background:
            radial-gradient(
              ellipse 70% 50% at 50% 55%,
              rgba(255, 220, 140, 0.2) 0%,
              rgba(255, 180, 60, 0) 65%
            ),
            radial-gradient(
              ellipse 80% 35% at 50% 100%,
              rgba(0, 0, 0, 0.45) 0%,
              rgba(0, 0, 0, 0) 70%
            );
          pointer-events: none;
        }
        .gd-city-stage {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          will-change: transform;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          cursor: grab;
          animation: cityWiggle 6s ease-in-out infinite;
        }
        .gd-city-stage.gd-dragging {
          animation: none;
          cursor: grabbing;
        }
        @keyframes cityWiggle {
          0%, 100% { transform: rotateY(-2deg); }
          50%      { transform: rotateY(2deg); }
        }
        /* neutralise CityPreview's own frame */
        .gd-city-stage :global(.city-preview) {
          max-width: 100% !important;
          width: 100%;
          filter: none;
        }
        .gd-city-stage :global(.city-preview .card) {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .gd-city-stage :global(.city-preview .card-inner) {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          aspect-ratio: auto !important;
          height: 100% !important;
        }
        .gd-city-stage :global(.city-preview .card-header),
        .gd-city-stage :global(.city-preview .card-footer) {
          display: none !important;
        }
        .gd-city-stage :global(svg) {
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.7));
        }

        /* ===== Coins overflow build-hint ===== */
        .gd-build-hint {
          position: absolute;
          right: 18px;
          top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 11px 6px 9px;
          border-radius: 999px;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 25%, #c8891e 100%);
          border: 2.5px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1.5px 0 rgba(60, 20, 0, 0.55),
            0 2px 0 #0d0a06,
            0 4px 10px rgba(0, 0, 0, 0.6),
            0 0 16px rgba(240, 184, 64, 0.7);
          text-decoration: none;
          color: #2a1505;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(255, 246, 220, 0.85);
          animation: buildHintBob 2.4s ease-in-out infinite;
          z-index: 3;
        }
        .gd-build-hint-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #c0392b;
          box-shadow: 0 0 8px rgba(192, 57, 43, 0.9);
        }
        .gd-build-hint-label {
          color: #2a1505;
        }
        .gd-build-hint-arrow {
          font-size: 16px;
          line-height: 1;
        }
        @keyframes buildHintBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }

        /* ===== Stats ===== */
        .gd-stats {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 8px;
          z-index: 1;
          position: relative;
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
          min-height: 54px;
          overflow: hidden;
        }
        .gd-chip::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255, 246, 220, 0.14), rgba(255, 246, 220, 0));
          pointer-events: none;
          border-radius: 13px 13px 0 0;
        }
        .gd-chip-icon {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
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
          box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.9);
          margin-top: 5px;
          overflow: hidden;
        }
        .gd-chip-bar-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 30%, #f0b840 70%, #c8891e 100%);
          box-shadow: 0 0 10px rgba(240, 184, 64, 0.9);
          transition: width 400ms ease-out;
        }
        .gd-chip-bar-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
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
          border-radius: 22px;
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 10%, #f0b840 30%, #8a5a10 70%, #2a1505 100%);
          border: 4px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.8),
            inset 0 -3px 0 rgba(60, 20, 0, 0.6),
            0 6px 0 #0d0a06,
            0 14px 26px rgba(0, 0, 0, 0.7),
            0 0 30px rgba(240, 184, 64, 0.45);
          transition: transform 120ms ease-out;
          z-index: 2;
        }
        .gd-quest:active { transform: scale(0.97) translateY(2px); }
        .gd-quest-pulse { animation: questPulse 2.2s ease-in-out infinite; }
        @keyframes questPulse {
          0%, 100% {
            box-shadow:
              inset 0 2px 0 rgba(255,255,255,0.8),
              inset 0 -3px 0 rgba(60,20,0,0.6),
              0 6px 0 #0d0a06,
              0 14px 26px rgba(0,0,0,0.7),
              0 0 28px rgba(240,184,64,0.45);
          }
          50% {
            box-shadow:
              inset 0 2px 0 rgba(255,255,255,0.8),
              inset 0 -3px 0 rgba(60,20,0,0.6),
              0 6px 0 #0d0a06,
              0 14px 28px rgba(0,0,0,0.7),
              0 0 48px rgba(255,210,100,0.9);
          }
        }
        .gd-quest-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #ff6a4a 0%, #c0392b 55%, #7a1e0a 100%);
          border: 2.5px solid #fff6dc;
          box-shadow:
            0 2px 0 #0d0a06,
            0 0 14px rgba(230, 40, 20, 0.9),
            inset 0 1.5px 0 rgba(255, 255, 255, 0.7);
          z-index: 5;
          animation: badgePulse 1.6s ease-in-out infinite;
        }
        .gd-quest-badge::after {
          content: '!';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff6dc;
          font-family: var(--font-display), system-ui, sans-serif;
          font-size: 13px;
          text-shadow: 0 1px 0 #3d0a00;
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
        .gd-quest-inner {
          position: relative;
          padding: 11px 14px 11px;
          border-radius: 17px;
          background: linear-gradient(180deg, #213f6f 0%, #13284d 40%, #091530 100%);
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
          background: radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255, 220, 140, 0.22), rgba(255, 220, 140, 0) 70%);
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
          margin-bottom: 8px;
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
        .gd-quest-text {
          font-size: 16px;
          line-height: 1.25;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0a06;
          min-height: 40px;
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
          margin-top: 8px;
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
          margin-top: 9px;
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
          font-size: 16px;
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
          font-size: 22px;
          color: #2a1505;
          text-shadow: 0 1.5px 0 rgba(255, 246, 220, 0.65);
          line-height: 1;
        }

        /* ===== Countdown ===== */
        .gd-countdown {
          display: inline-flex;
          align-self: center;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(10, 18, 38, 0.8);
          border: 1.5px solid rgba(240, 184, 64, 0.45);
          box-shadow:
            inset 0 1px 0 rgba(240, 184, 64, 0.25),
            0 2px 8px rgba(0, 0, 0, 0.5);
          color: #fdd069;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 #0d0a06;
          z-index: 1;
        }
        .gd-countdown-urgent {
          color: #ff8a5a;
          border-color: rgba(230, 80, 40, 0.75);
          background: rgba(58, 12, 5, 0.85);
          box-shadow:
            inset 0 1px 0 rgba(255, 138, 90, 0.4),
            0 2px 10px rgba(0, 0, 0, 0.6),
            0 0 14px rgba(230, 80, 40, 0.55);
          animation: urgentBlink 1.6s ease-in-out infinite;
        }
        @keyframes urgentBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.75; }
        }

        /* ===== Chests ===== */
        .gd-chests {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          z-index: 1;
          position: relative;
        }
        .gd-chest {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 4px 6px;
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
          overflow: visible;
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
          border-radius: 11px 11px 0 0;
        }
        .gd-chest:active { transform: scale(0.95); }
        .gd-chest-art {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 36px;
          filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.9));
        }
        .gd-chest-locked .gd-chest-art {
          opacity: 0.55;
        }
        .gd-chest-lock {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
          opacity: 1 !important;
        }
        .gd-chest-ready {
          background: linear-gradient(180deg, #5c3a1e 0%, #3d2410 50%, #1a0f05 100%);
          animation: chestGlow 2s ease-in-out infinite, chestShake 4s ease-in-out infinite;
        }
        @keyframes chestGlow {
          0%, 100% {
            box-shadow:
              inset 0 2px 0 rgba(255, 220, 140, 0.7),
              inset 0 -2px 0 rgba(0, 0, 0, 0.75),
              inset 0 0 0 1px rgba(253, 208, 105, 0.5),
              0 4px 0 #0d0a06,
              0 6px 10px rgba(0, 0, 0, 0.55),
              0 0 18px rgba(240, 184, 64, 0.7);
          }
          50% {
            box-shadow:
              inset 0 2px 0 rgba(255, 220, 140, 0.85),
              inset 0 -2px 0 rgba(0, 0, 0, 0.75),
              inset 0 0 0 1px rgba(253, 208, 105, 0.7),
              0 4px 0 #0d0a06,
              0 6px 10px rgba(0, 0, 0, 0.55),
              0 0 32px rgba(255, 210, 100, 1);
          }
        }
        .gd-chest-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff6dc 0%, #fdd069 40%, #c8891e 100%);
          border: 2px solid #0d0a06;
          box-shadow:
            0 0 10px rgba(255, 220, 140, 1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          z-index: 4;
          animation: badgePulse 1.4s ease-in-out infinite;
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
          text-shadow: 0 1px 0 #0d0a06, 0 0 8px rgba(240, 184, 64, 0.9);
        }
        .gd-chest-locked .gd-chest-caption {
          opacity: 0.75;
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
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
 * BigChest — volumetric SVG chest with lid, bands and padlock
 * face. Two variants: wood (free chest) and stone (locked).
 * ============================================================ */
function BigChest({ variant }: { variant: 'wood' | 'stone' }) {
  const pal =
    variant === 'wood'
      ? {
          bodyTop: '#c08038',
          bodyMid: '#8a5224',
          bodyBot: '#4a2a10',
          lidTop: '#d89248',
          lidBot: '#7a4418',
          band: '#f0b840',
          bandShade: '#8a5a10',
          plate: '#fdd069',
          plateShade: '#8a5a10',
          outline: '#1a0f05',
        }
      : {
          bodyTop: '#8e8472',
          bodyMid: '#5a5245',
          bodyBot: '#2e2a22',
          lidTop: '#a89c86',
          lidBot: '#5a4e3a',
          band: '#c8bfb0',
          bandShade: '#605848',
          plate: '#d8cfb8',
          plateShade: '#605848',
          outline: '#0d0a06',
        };
  return (
    <svg viewBox="0 0 48 40" width="44" height="36" fill="none">
      <defs>
        <linearGradient id={`chest-body-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.bodyTop} />
          <stop offset="0.55" stopColor={pal.bodyMid} />
          <stop offset="1" stopColor={pal.bodyBot} />
        </linearGradient>
        <linearGradient id={`chest-lid-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.lidTop} />
          <stop offset="1" stopColor={pal.lidBot} />
        </linearGradient>
        <linearGradient id={`chest-band-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.45" stopColor={pal.band} />
          <stop offset="1" stopColor={pal.bandShade} />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="24" cy="37" rx="20" ry="2.2" fill="rgba(0,0,0,0.5)" />
      {/* body */}
      <path
        d="M4 18 L44 18 L44 35 Q44 37 42 37 L6 37 Q4 37 4 35 Z"
        fill={`url(#chest-body-${variant})`}
        stroke={pal.outline}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* body vertical planks */}
      <line x1="14" y1="18" x2="14" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      <line x1="24" y1="18" x2="24" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      <line x1="34" y1="18" x2="34" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      {/* lid dome */}
      <path
        d="M4 18 Q4 6 24 6 Q44 6 44 18 Z"
        fill={`url(#chest-lid-${variant})`}
        stroke={pal.outline}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* lid highlight */}
      <path
        d="M8 14 Q12 8 22 7"
        stroke="#fff6dc"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* horizontal band across body/lid join */}
      <rect x="4" y="17" width="40" height="3.2" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1.2" />
      {/* rivets on band */}
      <circle cx="9" cy="18.6" r="1" fill={pal.plate} stroke={pal.outline} strokeWidth="0.5" />
      <circle cx="39" cy="18.6" r="1" fill={pal.plate} stroke={pal.outline} strokeWidth="0.5" />
      {/* vertical gold straps left/right */}
      <rect x="7" y="18" width="3" height="19" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1" />
      <rect x="38" y="18" width="3" height="19" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1" />
      {/* plate in centre */}
      <rect
        x="20"
        y="19"
        width="8"
        height="10"
        rx="1"
        fill={pal.plate}
        stroke={pal.outline}
        strokeWidth="1.2"
      />
      <rect x="20" y="19" width="8" height="2.5" fill="#fff6dc" opacity="0.6" />
      {/* keyhole */}
      <circle cx="24" cy="23.5" r="1.1" fill={pal.outline} />
      <rect x="23.4" y="23.5" width="1.2" height="3" fill={pal.outline} />
    </svg>
  );
}
