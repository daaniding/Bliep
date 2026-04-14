'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import HomeCityScene from './HomeCityScene';
import {
  TrophyIcon,
  ScrollIcon,
  SwordIcon,
  CastleIcon,
  LockIcon,
} from './icons/GameIcons';
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
 * GameDashboard — Clash Royale layout:
 *
 *   "Koninkrijk Lvl X"
 *   ┌──┐                ┌──┐
 *   │🏆│   ╔═════════╗  │⚔ │
 *   │📜│   ║  CITY   ║  │🛡│
 *   └──┘   ╚═════════╝  └──┘
 *           [DOE OPDRACHT]
 *           [chest][chest][chest][chest]
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

export default function GameDashboard() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [pick, setPick] = useState<DailyPick | null>(null);
  const [chestMs, setChestMs] = useState<number>(0);
  const [buildingCount, setBuildingCount] = useState(1);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setTasks(getDailyTasks());
    setPick(loadDailyPick());

    const refresh = () => {
      setChestMs(msUntilReady(loadFreeChest()));
      setPick(loadDailyPick());
      const c = loadCity();
      setBuildingCount(Math.max(1, c.buildings.length));
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

  const chosenTask = pick?.chosenId ? tasks.find((t) => t.id === pick.chosenId) ?? null : null;
  const questPending = !pick?.completed;

  const ctaLabel = pick?.completed
    ? 'Voltooid ✓'
    : chosenTask
      ? 'Hervat Opdracht'
      : 'Start Opdracht';

  const freeChestAvailable = chestReady(loadFreeChest());

  return (
    <div className="gd-root">
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

      {/* ===== Kingdom level label ===== */}
      <div className="gd-kingdom animate-fade-up" style={{ animationDelay: '40ms' }}>
        <span className="gd-kingdom-pill font-display">
          KONINKRIJK <span className="gd-kingdom-lvl">LVL {buildingCount}</span>
        </span>
      </div>

      {/* ===== Center stage: side rails + city ===== */}
      <div className="gd-stage animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="gd-rail gd-rail-left">
          <RailButton href="/league" label="LEAGUE">
            <TrophyIcon size={26} />
          </RailButton>
          <RailButton href="/meer" label="MEER">
            <ScrollIcon size={26} />
          </RailButton>
        </div>

        <div className="gd-city-wrap">
          <HomeCityScene />
        </div>

        <div className="gd-rail gd-rail-right">
          <RailButton href="/aanvallen" label="AANVAL" tone="red">
            <SwordIcon size={26} />
          </RailButton>
          <RailButton href="/stad" label="STAD">
            <CastleIcon size={26} />
          </RailButton>
        </div>
      </div>

      {/* ===== DOE OPDRACHT button ===== */}
      <Link
        href="/opdracht"
        onClick={() => sfxTap()}
        className={`gd-doe animate-fade-up ${questPending ? 'gd-doe-pulse' : 'gd-doe-done'}`}
        style={{ animationDelay: '220ms' }}
      >
        {questPending && <span className="gd-doe-badge" aria-hidden />}
        <span className="gd-doe-label font-display">{ctaLabel}</span>
      </Link>

      {/* ===== Chest slots row ===== */}
      <div className="gd-chests animate-fade-up" style={{ animationDelay: '320ms' }}>
        {[0, 1, 2, 3].map((i) => {
          const isFirst = i === 0;
          const active = isFirst && freeChestAvailable;
          return (
            <Link
              key={i}
              href={isFirst ? '/opdracht' : '/aanvallen'}
              onClick={(e) => {
                if (!isFirst) e.preventDefault();
                sfxTap();
              }}
              className={`gd-chest ${active ? 'gd-chest-ready' : ''} ${!isFirst ? 'gd-chest-locked' : ''}`}
              aria-label={isFirst ? 'Gratis kist' : 'Vergrendelde kist'}
            >
              {active && <span className="gd-chest-badge" aria-hidden />}
              <div className="gd-chest-art">
                <BigChest variant={isFirst ? 'wood' : 'stone'} />
                {!isFirst && (
                  <span className="gd-chest-lock">
                    <LockIcon size={20} />
                  </span>
                )}
              </div>
              <span className="gd-chest-caption font-display">
                {isFirst ? (active ? 'GRATIS' : formatMs(chestMs)) : 'LOCKED'}
              </span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .gd-root {
          position: relative;
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          padding: calc(env(safe-area-inset-top, 0px) + 110px) 12px
            calc(env(safe-area-inset-bottom, 0px) + 130px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 100dvh;
        }

        /* sparkles */
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
            rgba(220, 240, 255, 1) 0%,
            rgba(140, 200, 255, 0.6) 40%,
            rgba(140, 200, 255, 0) 100%
          );
          box-shadow: 0 0 6px rgba(180, 220, 255, 0.9);
          animation: sparkleDrift 6s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes sparkleDrift {
          0%, 100% { opacity: 0; transform: translate(0, 0) scale(0.5); }
          35%, 65% { opacity: 0.9; transform: translate(4px, -6px) scale(1.2); }
        }

        /* ===== Kingdom label ===== */
        .gd-kingdom {
          display: flex;
          justify-content: center;
          z-index: 1;
        }
        .gd-kingdom-pill {
          padding: 5px 16px;
          border-radius: 999px;
          background: linear-gradient(180deg, #04132a 0%, #02091a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            inset 0 1.5px 0 rgba(74, 157, 232, 0.55),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.85),
            0 3px 0 #02091a,
            0 6px 14px rgba(0, 0, 0, 0.55);
          font-size: 11px;
          letter-spacing: 0.18em;
          color: #b8d8ff;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 #02091a;
        }
        .gd-kingdom-lvl {
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #02091a, 0 0 8px rgba(240, 184, 64, 0.5);
        }

        /* ===== Stage ===== */
        .gd-stage {
          position: relative;
          width: 100%;
          flex: 0 0 auto;
          height: 36vh;
          min-height: 260px;
          max-height: 340px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 6px;
          align-items: stretch;
          z-index: 1;
          overflow: hidden;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 75% 55% at 50% 30%,
              rgba(180, 230, 255, 0.35) 0%,
              rgba(100, 180, 240, 0.1) 55%,
              rgba(20, 60, 120, 0) 90%),
            linear-gradient(180deg,
              #6ab6f0 0%,
              #4a9de8 25%,
              #2f7fc8 55%,
              #1a5a9a 85%,
              #0a3a6a 100%);
          border: 3px solid rgba(255, 255, 255, 0.35);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.5),
            inset 0 -10px 30px rgba(0, 30, 80, 0.55),
            0 8px 18px rgba(0, 0, 0, 0.6),
            0 0 0 2px #0d1a38;
        }
        .gd-stage::before {
          content: '';
          position: absolute;
          inset: -10px -20px 0;
          background:
            radial-gradient(
              ellipse 65% 50% at 50% 55%,
              rgba(255, 220, 140, 0.18) 0%,
              rgba(255, 180, 60, 0) 65%
            ),
            radial-gradient(
              ellipse 70% 90% at 50% 45%,
              rgba(20, 60, 120, 0.7) 0%,
              rgba(20, 60, 120, 0) 75%
            );
          pointer-events: none;
        }
        .gd-stage::after {
          content: '';
          position: absolute;
          left: 12%;
          right: 12%;
          bottom: 12px;
          height: 16px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0) 70%
          );
          pointer-events: none;
        }

        .gd-rail {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          z-index: 2;
        }

        .gd-city-wrap {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 260px;
          display: block;
          z-index: 1;
        }

        /* ===== Doe Opdracht ===== */
        .gd-doe {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 24px;
          border-radius: 14px;
          background: linear-gradient(180deg, #ffe566 0%, #f0b840 30%, #c8891e 70%, #8a5a10 100%);
          border: 3px solid #3d2800;
          box-shadow:
            0 6px 0 #3d2800,
            0 10px 24px rgba(0, 0, 0, 0.6),
            inset 0 2px 0 rgba(255, 255, 255, 0.6),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3),
            0 0 28px rgba(240, 184, 64, 0.45);
          text-decoration: none;
          z-index: 2;
          transition: transform 100ms ease-out;
        }
        .gd-doe:active {
          transform: translateY(3px);
          box-shadow:
            0 3px 0 #3d2800,
            0 5px 12px rgba(0, 0, 0, 0.6),
            inset 0 2px 0 rgba(255, 255, 255, 0.6),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3);
        }
        .gd-doe-pulse {
          animation: doePulse 2s ease-in-out infinite;
        }
        @keyframes doePulse {
          0%, 100% {
            box-shadow:
              0 6px 0 #3d2800,
              0 10px 24px rgba(0, 0, 0, 0.6),
              inset 0 2px 0 rgba(255, 255, 255, 0.6),
              inset 0 -3px 0 rgba(0, 0, 0, 0.3),
              0 0 28px rgba(240, 184, 64, 0.45);
          }
          50% {
            box-shadow:
              0 6px 0 #3d2800,
              0 10px 26px rgba(0, 0, 0, 0.6),
              inset 0 2px 0 rgba(255, 255, 255, 0.6),
              inset 0 -3px 0 rgba(0, 0, 0, 0.3),
              0 0 50px rgba(255, 220, 100, 0.95);
          }
        }
        .gd-doe-done {
          background: linear-gradient(180deg, #c0e0a0 0%, #6ec060 30%, #3d8a35 70%, #1e4a18 100%);
          border-color: #0d2a08;
          box-shadow:
            0 6px 0 #0d2a08,
            0 10px 24px rgba(0, 0, 0, 0.6),
            inset 0 2px 0 rgba(255, 255, 255, 0.6),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3);
        }
        .gd-doe-label {
          font-size: 22px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #2a1505;
          text-shadow: 0 2px 0 rgba(255, 246, 220, 0.55);
          line-height: 1;
        }
        .gd-doe-done .gd-doe-label {
          color: #0d2a08;
          text-shadow: 0 2px 0 rgba(255, 255, 255, 0.4);
        }
        .gd-doe-badge {
          position: absolute;
          top: -7px;
          right: -7px;
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
        .gd-doe-badge::after {
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
          border-radius: 12px;
          background: linear-gradient(180deg, #0a2d54 0%, #04132a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            0 4px 0 #061828,
            0 8px 14px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.6);
          text-decoration: none;
          min-height: 78px;
          overflow: visible;
          transition: transform 120ms ease-out;
        }
        .gd-chest:active { transform: translateY(2px); }
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
          opacity: 0.5;
        }
        .gd-chest-lock {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1 !important;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
        }
        .gd-chest-ready {
          border-color: #f0b840;
          background: linear-gradient(180deg, #143b6a 0%, #0a2349 100%);
          animation: chestGlow 2s ease-in-out infinite, chestShake 4s ease-in-out infinite;
        }
        @keyframes chestGlow {
          0%, 100% {
            box-shadow:
              0 4px 0 #6e4c10,
              0 8px 14px rgba(0, 0, 0, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              inset 0 -1.5px 0 rgba(0, 0, 0, 0.6),
              0 0 18px rgba(240, 184, 64, 0.7);
          }
          50% {
            box-shadow:
              0 4px 0 #6e4c10,
              0 8px 14px rgba(0, 0, 0, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              inset 0 -1.5px 0 rgba(0, 0, 0, 0.6),
              0 0 32px rgba(255, 210, 100, 1);
          }
        }
        @keyframes chestShake {
          0%, 88%, 100% { transform: translateX(0) rotate(0deg); }
          90%           { transform: translateX(-2px) rotate(-3deg); }
          92%           { transform: translateX(2px) rotate(3deg); }
          94%           { transform: translateX(-2px) rotate(-2deg); }
          96%           { transform: translateX(2px) rotate(2deg); }
        }
        .gd-chest-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff6dc 0%, #fdd069 40%, #c8891e 100%);
          border: 2px solid #02091a;
          box-shadow:
            0 0 10px rgba(255, 220, 140, 1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          z-index: 4;
          animation: badgePulse 1.4s ease-in-out infinite;
        }
        .gd-chest-caption {
          font-size: 10px;
          color: #b8d8ff;
          letter-spacing: 0.1em;
          text-shadow: 0 1px 0 #02091a;
          text-transform: uppercase;
          line-height: 1;
        }
        .gd-chest-ready .gd-chest-caption {
          color: #fff6dc;
          text-shadow: 0 1px 0 #02091a, 0 0 8px rgba(240, 184, 64, 0.9);
        }
        .gd-chest-locked .gd-chest-caption {
          opacity: 0.65;
        }

        /* ===== Animations ===== */
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
 * RailButton — squared icon button used in the side rails
 * around the city stage.
 * ============================================================ */
function RailButton({
  href,
  label,
  children,
  tone = 'blue',
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  tone?: 'blue' | 'red';
}) {
  const isRed = tone === 'red';
  return (
    <Link
      href={href}
      onClick={() => sfxTap()}
      className={`rail-btn ${isRed ? 'rail-btn-red' : ''}`}
      aria-label={label}
    >
      <span className="rail-btn-icon">{children}</span>
      <span className="rail-btn-label font-display">{label}</span>
      <style jsx>{`
        .rail-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          width: 50px;
          padding: 6px 4px 4px;
          border-radius: 12px;
          background: linear-gradient(180deg, #0a2d54 0%, #04132a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            0 4px 0 #061828,
            0 8px 14px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.6);
          text-decoration: none;
          color: #b8d8ff;
          transition: transform 100ms ease-out;
        }
        .rail-btn:active { transform: translateY(2px); }
        .rail-btn-red {
          background: linear-gradient(180deg, #5a0e08 0%, #2a0500 100%);
          border-color: #c0392b;
          box-shadow:
            0 4px 0 #2a0500,
            0 8px 14px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 200, 180, 0.25),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.7),
            0 0 18px rgba(192, 57, 43, 0.55);
          color: #ffe0d6;
        }
        .rail-btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #1a3a6a 0%, #02091a 80%);
          border: 2px solid #4a9de8;
          box-shadow:
            inset 0 0 8px rgba(0, 0, 0, 0.85),
            0 1px 0 #02091a;
        }
        .rail-btn-red .rail-btn-icon {
          background: radial-gradient(circle at 32% 28%, #7a1e0a 0%, #2a0500 80%);
          border-color: #ff8a5a;
        }
        .rail-btn-label {
          font-size: 8px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 #02091a;
        }
      `}</style>
    </Link>
  );
}

/* ============================================================
 * BigChest — volumetric SVG chest used in the slot row.
 * ============================================================ */
function BigChest({ variant }: { variant: 'wood' | 'stone' }) {
  const pal =
    variant === 'wood'
      ? {
          bodyTop: '#c08038',
          bodyMid: '#8a5224',
          bodyBot: '#3a1c08',
          lidTop: '#d89248',
          lidBot: '#7a4418',
          band: '#f0b840',
          bandShade: '#8a5a10',
          plate: '#fdd069',
          outline: '#0d0a06',
        }
      : {
          bodyTop: '#8e9aab',
          bodyMid: '#4e5a6a',
          bodyBot: '#1e2632',
          lidTop: '#a8b4c8',
          lidBot: '#525e72',
          band: '#c8d2e0',
          bandShade: '#525e72',
          plate: '#d8e0ec',
          outline: '#02091a',
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
      <ellipse cx="24" cy="37" rx="20" ry="2.2" fill="rgba(0,0,0,0.5)" />
      <path d="M4 18 L44 18 L44 35 Q44 37 42 37 L6 37 Q4 37 4 35 Z" fill={`url(#chest-body-${variant})`} stroke={pal.outline} strokeWidth="2" strokeLinejoin="round" />
      <line x1="14" y1="18" x2="14" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      <line x1="24" y1="18" x2="24" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      <line x1="34" y1="18" x2="34" y2="37" stroke={pal.outline} strokeWidth="1" opacity="0.55" />
      <path d="M4 18 Q4 6 24 6 Q44 6 44 18 Z" fill={`url(#chest-lid-${variant})`} stroke={pal.outline} strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 14 Q12 8 22 7" stroke="#fff6dc" strokeWidth="1.4" fill="none" opacity="0.55" strokeLinecap="round" />
      <rect x="4" y="17" width="40" height="3.2" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1.2" />
      <circle cx="9" cy="18.6" r="1" fill={pal.plate} stroke={pal.outline} strokeWidth="0.5" />
      <circle cx="39" cy="18.6" r="1" fill={pal.plate} stroke={pal.outline} strokeWidth="0.5" />
      <rect x="7" y="18" width="3" height="19" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1" />
      <rect x="38" y="18" width="3" height="19" fill={`url(#chest-band-${variant})`} stroke={pal.outline} strokeWidth="1" />
      <rect x="20" y="19" width="8" height="10" rx="1" fill={pal.plate} stroke={pal.outline} strokeWidth="1.2" />
      <rect x="20" y="19" width="8" height="2.5" fill="#fff6dc" opacity="0.6" />
      <circle cx="24" cy="23.5" r="1.1" fill={pal.outline} />
      <rect x="23.4" y="23.5" width="1.2" height="3" fill={pal.outline} />
    </svg>
  );
}
