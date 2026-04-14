'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import KingdomScene2D from './KingdomScene2D';
import {
  TrophyIcon,
  ScrollIcon,
  SwordIcon,
  CastleIcon,
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
 * GameDashboard — Warm Royal home:
 *
 *   KONINKRIJK LVL X
 *   ╔══════════════════════════╗
 *   ║  [KingdomScene2D village] ║  ← real pixel art
 *   ╚══════════════════════════╝
 *   🏆  🛡                 ⚔  🏰       ← side rails
 *       [ START OPDRACHT ]
 *   chest · chest · chest · chest
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
      ? 'Hervat opdracht'
      : 'Start opdracht';

  const freeChestAvailable = chestReady(loadFreeChest());

  return (
    <div className="gd-root">
      {/* ===== Kingdom level label ===== */}
      <div className="gd-kingdom animate-fade-up" style={{ animationDelay: '40ms' }}>
        <span className="gd-kingdom-pill font-display">
          KONINKRIJK <span className="gd-kingdom-lvl">LVL {buildingCount}</span>
        </span>
      </div>

      {/* ===== Side rails + fullwidth village stage ===== */}
      <div className="gd-stage-outer animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="gd-stage">
          <KingdomScene2D />
          <div className="gd-stage-fade" />
        </div>

        {/* Left rail — floats on top of the stage */}
        <div className="gd-rail gd-rail-left">
          <Link href="/league" onClick={() => sfxTap()} className="kenney-btn-square kenney-btn-square-brown" aria-label="League">
            <TrophyIcon size={26} />
            <span className="gd-rail-label">LEAGUE</span>
          </Link>
          <Link href="/meer" onClick={() => sfxTap()} className="kenney-btn-square kenney-btn-square-brown" aria-label="Meer">
            <ScrollIcon size={26} />
            <span className="gd-rail-label">MEER</span>
          </Link>
        </div>

        {/* Right rail */}
        <div className="gd-rail gd-rail-right">
          <Link href="/aanvallen" onClick={() => sfxTap()} className="kenney-btn-square kenney-btn-square-blue" aria-label="Aanvallen">
            <SwordIcon size={26} />
            <span className="gd-rail-label">AANVAL</span>
          </Link>
          <Link href="/stad" onClick={() => sfxTap()} className="kenney-btn-square kenney-btn-square-brown" aria-label="Stad">
            <CastleIcon size={26} />
            <span className="gd-rail-label">STAD</span>
          </Link>
        </div>
      </div>

      {/* ===== START OPDRACHT ===== */}
      <div className="gd-cta-wrap">
        <Link
          href="/opdracht"
          onClick={() => sfxTap()}
          className={`kenney-btn ${questPending ? 'kenney-btn-beige animate-cta-pulse' : 'kenney-btn-blue'} gd-cta animate-fade-up`}
          style={{ animationDelay: '220ms' }}
        >
          {questPending && <span className="gd-cta-badge" aria-hidden />}
          <span className="gd-cta-label">{ctaLabel}</span>
        </Link>
      </div>

      {/* ===== Chest slots ===== */}
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
              className={`kenney-panel-wood gd-chest ${active ? 'animate-glow-pulse' : ''} ${!isFirst ? 'gd-chest-locked' : ''}`}
              aria-label={isFirst ? 'Gratis kist' : 'Vergrendelde kist'}
            >
              {active && <span className="gd-chest-badge" aria-hidden />}
              <div className="gd-chest-art">
                <img
                  src={
                    isFirst
                      ? '/assets/kenney/buildings/medievalStructure_18.png'
                      : '/assets/kenney/buildings/medievalStructure_03.png'
                  }
                  alt=""
                  className="sprite-pixel"
                  width={42}
                  height={42}
                />
                {!isFirst && (
                  <span className="gd-chest-lock">
                    <img
                      src="/assets/kenney/ui-icons/iconCross_brown.png"
                      alt=""
                      width={18}
                      height={18}
                      className="sprite-pixel"
                    />
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
          padding: calc(env(safe-area-inset-top, 0px) + 112px) 12px
            calc(env(safe-area-inset-bottom, 0px) + 130px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 100dvh;
        }

        /* ===== Kingdom label ===== */
        .gd-kingdom {
          display: flex;
          justify-content: center;
          z-index: 2;
        }
        .gd-kingdom-pill {
          padding: 5px 18px 7px;
          border-radius: 999px;
          background: linear-gradient(180deg, #3d1220 0%, #1a0510 100%);
          border: 2px solid #f0b840;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 220, 140, 0.55),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.85),
            0 3px 0 #0d0208,
            0 6px 14px rgba(0, 0, 0, 0.65);
          font-size: 11px;
          letter-spacing: 0.18em;
          color: #fae6b6;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 #0d0208;
        }
        .gd-kingdom-lvl {
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0208, 0 0 10px rgba(240, 184, 64, 0.75);
        }

        /* ===== Stage ===== */
        .gd-stage-outer {
          position: relative;
          width: calc(100% + 24px);
          margin: 0 -12px;
          z-index: 1;
        }
        .gd-stage {
          position: relative;
          width: 100%;
          height: 38vh;
          min-height: 240px;
          max-height: 340px;
          overflow: hidden;
          border-top: 3px solid #f0b840;
          border-bottom: 3px solid #f0b840;
          box-shadow:
            inset 0 0 0 1px rgba(255, 246, 220, 0.18),
            inset 0 -40px 60px -30px rgba(0, 0, 0, 0.85),
            inset 0 40px 40px -30px rgba(0, 0, 0, 0.55),
            0 6px 14px rgba(0, 0, 0, 0.55);
        }
        .gd-stage-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgba(26, 5, 16, 0.55) 0%,
              rgba(26, 5, 16, 0) 22%,
              rgba(26, 5, 16, 0) 78%,
              rgba(26, 5, 16, 0.65) 100%
            );
        }

        /* ===== Side rails ===== */
        .gd-rail {
          position: absolute;
          top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 100;
        }
        .gd-rail-left { left: 14px; }
        .gd-rail-right { right: 14px; }
        .gd-rail :global(.kenney-btn-square) {
          width: 54px;
          min-width: 54px;
          min-height: 58px;
          padding-top: 8px;
          padding-bottom: 12px;
          gap: 1px;
        }
        .gd-rail-label {
          margin-top: -1px;
        }

        /* ===== CTA ===== */
        .gd-cta-wrap {
          display: flex;
          justify-content: center;
          z-index: 2;
          margin-top: 2px;
        }
        :global(.gd-cta) {
          position: relative;
          width: 100%;
          max-width: 360px;
          min-height: 68px;
          padding: 18px 28px 24px !important;
          font-size: 22px !important;
        }
        .gd-cta-label {
          position: relative;
          top: -2px;
        }
        .gd-cta-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #ff6a4a 0%, #c0392b 55%, #7a1e0a 100%);
          border: 2.5px solid #fff6dc;
          box-shadow:
            0 2px 0 #0d0208,
            0 0 14px rgba(230, 40, 20, 0.9),
            inset 0 1.5px 0 rgba(255, 255, 255, 0.7);
          z-index: 5;
          animation: badgePulse 1.6s ease-in-out infinite;
        }
        .gd-cta-badge::after {
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
          50%      { transform: scale(1.14); }
        }

        /* ===== Chests ===== */
        .gd-chests {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          z-index: 1;
          position: relative;
        }
        :global(.gd-chest) {
          position: relative;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 4px 12px !important;
          text-decoration: none;
          min-height: 84px;
          overflow: visible !important;
          transition: transform 120ms ease-out;
        }
        :global(.gd-chest):active { transform: translateY(2px); }
        .gd-chest-art {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
        }
        .gd-chest-locked .gd-chest-art :global(img:not(.gd-chest-lock img)) {
          opacity: 0.5;
          filter: grayscale(0.6);
        }
        .gd-chest-lock {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
        }
        .gd-chest-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff6dc 0%, #fdd069 40%, #c8891e 100%);
          border: 2px solid #3d1220;
          box-shadow:
            0 0 10px rgba(255, 220, 140, 1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          z-index: 4;
          animation: badgePulse 1.4s ease-in-out infinite;
        }
        .gd-chest-caption {
          font-size: 10px;
          color: #fae6b6;
          letter-spacing: 0.1em;
          text-shadow: 0 1px 0 #0d0208;
          text-transform: uppercase;
          line-height: 1;
        }
        .gd-chest-locked .gd-chest-caption {
          color: #d6b67a;
          opacity: 0.75;
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
