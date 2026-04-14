'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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

  // city rotation
  const [cityRotation, setCityRotation] = useState(0);
  const dragRef = useRef<{ startX: number; startRot: number; dragging: boolean }>({
    startX: 0,
    startRot: 0,
    dragging: false,
  });
  const [dragging, setDragging] = useState(false);

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

  // ===== drag handlers =====
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
    setCityRotation(Math.max(-35, Math.min(35, dragRef.current.startRot + dx * 0.35)));
  };
  const onTouchEnd = () => {
    dragRef.current.dragging = false;
    setDragging(false);
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current.startX = e.clientX;
    dragRef.current.startRot = cityRotation;
    dragRef.current.dragging = true;
    setDragging(true);
    const move = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      setCityRotation(Math.max(-35, Math.min(35, dragRef.current.startRot + dx * 0.35)));
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
          <div
            className={`gd-city-stage ${dragging ? 'gd-dragging' : ''}`}
            style={{ transform: `rotateY(${cityRotation}deg)` }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            onMouseDown={onMouseDown}
          >
            <KingdomStage buildingCount={buildingCount} />
          </div>
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
        style={{
          animationDelay: '220ms',
          backgroundImage: `url('/assets/kenney/ui-buttons/${questPending ? 'buttonLong_beige' : 'buttonLong_blue'}.png')`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }}
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
              style={{
                backgroundImage: `url('/assets/kenney/ui-panels/${active ? 'panel_brown' : 'panel_blue'}.png')`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
              }}
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
                  style={{ width: 44, height: 44, imageRendering: 'pixelated' }}
                />
                {!isFirst && (
                  <span className="gd-chest-lock">
                    <img
                      src="/assets/kenney/ui-icons/iconCross_brown.png"
                      alt=""
                      width={18}
                      height={18}
                      style={{ imageRendering: 'pixelated' }}
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
          flex: 1 1 auto;
          min-height: 240px;
          max-height: 360px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 6px;
          align-items: center;
          z-index: 1;
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
          gap: 10px;
          z-index: 2;
        }

        .gd-city-wrap {
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 900px;
          z-index: 1;
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

        /* ===== Doe Opdracht ===== */
        .gd-doe {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px 24px 22px;
          background: url('/assets/kenney/ui-buttons/buttonLong_beige.png') center/100% 100% no-repeat;
          text-decoration: none;
          z-index: 2;
          transition: transform 80ms ease-out;
          filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55));
          min-height: 70px;
        }
        .gd-doe:active {
          background-image: url('/assets/kenney/ui-buttons/buttonLong_beige_pressed.png');
          transform: translateY(2px);
        }
        .gd-doe-pulse {
          animation: doePulse 2s ease-in-out infinite;
        }
        @keyframes doePulse {
          0%, 100% {
            filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 14px rgba(240, 184, 64, 0.55));
          }
          50% {
            filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 28px rgba(255, 220, 100, 0.95));
          }
        }
        .gd-doe-done {
          background-image: url('/assets/kenney/ui-buttons/buttonLong_blue.png');
        }
        .gd-doe-label {
          font-size: 24px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #3d2800;
          text-shadow: 0 2px 0 rgba(255, 246, 220, 0.7);
          line-height: 1;
          position: relative;
          top: -2px;
        }
        .gd-doe-done .gd-doe-label {
          color: #fff6dc;
          text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55);
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
          padding: 10px 6px 8px;
          background: url('/assets/kenney/ui-panels/panel-009.png') center/100% 100% no-repeat;
          text-decoration: none;
          min-height: 84px;
          overflow: visible;
          transition: transform 120ms ease-out;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55));
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
          background-image: url('/assets/kenney/ui-panels/panel-008.png');
          animation: chestGlow 2s ease-in-out infinite, chestShake 4s ease-in-out infinite;
        }
        @keyframes chestGlow {
          0%, 100% {
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 12px rgba(240, 184, 64, 0.7));
          }
          50% {
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 22px rgba(255, 210, 100, 1));
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
 * around the city stage. Uses Kenney buttonSquare PNGs.
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
  const bg =
    tone === 'red'
      ? '/assets/kenney/ui-buttons/buttonSquare_blue.png'
      : '/assets/kenney/ui-buttons/buttonSquare_brown.png';
  return (
    <Link
      href={href}
      onClick={() => sfxTap()}
      aria-label={label}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        width: 60,
        height: 66,
        padding: '6px 4px 12px',
        backgroundImage: `url('${bg}')`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        textDecoration: 'none',
        color: '#fff6dc',
        filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.55))',
        textShadow: '0 1.5px 0 rgba(0,0,0,0.85)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
        {children}
      </span>
      <span
        className="font-display"
        style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: -2,
          color: '#fff6dc',
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/* ============================================================
 * KingdomStage — composes Kenney sprites into a kingdom scene.
 * ============================================================ */
function KingdomStage({ buildingCount }: { buildingCount: number }) {
  // Show a few sprites; layout is fixed but level scales sprite count.
  const showFarm = buildingCount >= 2;
  const showBarracks = buildingCount >= 3;
  return (
    <div className="ks-root" aria-hidden>
      {/* sky halo */}
      <div className="ks-halo" />
      {/* ground ellipse shadow */}
      <div className="ks-ground" />

      {/* trees back */}
      <img className="ks-sprite ks-tree-l" src="/assets/kenney/environment/medievalEnvironment_03.png" alt="" />
      <img className="ks-sprite ks-tree-r" src="/assets/kenney/environment/medievalEnvironment_05.png" alt="" />

      {/* center castle */}
      <img className="ks-sprite ks-castle" src="/assets/kenney/buildings/medievalStructure_21.png" alt="" />

      {showFarm && (
        <img className="ks-sprite ks-house" src="/assets/kenney/buildings/medievalStructure_17.png" alt="" />
      )}
      {showBarracks && (
        <img className="ks-sprite ks-barracks" src="/assets/kenney/buildings/medievalStructure_12.png" alt="" />
      )}

      {/* villagers */}
      <img className="ks-sprite ks-villager-l" src="/assets/kenney/units/medievalUnit_01.png" alt="" />
      <img className="ks-sprite ks-villager-r" src="/assets/kenney/units/medievalUnit_05.png" alt="" />

      {/* foreground tree */}
      <img className="ks-sprite ks-tree-front" src="/assets/kenney/environment/medievalEnvironment_07.png" alt="" />

      <style jsx>{`
        .ks-root {
          position: relative;
          width: 100%;
          height: 100%;
          display: block;
        }
        .ks-halo {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              ellipse 60% 45% at 50% 55%,
              rgba(255, 220, 140, 0.22) 0%,
              rgba(255, 180, 60, 0) 65%
            );
          pointer-events: none;
        }
        .ks-ground {
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: 6px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0) 70%
          );
          pointer-events: none;
        }
        .ks-sprite {
          position: absolute;
          image-rendering: pixelated;
          filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.6));
          transform: translateX(-50%);
        }
        .ks-tree-l { left: 8%;  bottom: 22%; width: 38px; }
        .ks-tree-r { left: 92%; bottom: 26%; width: 32px; }
        .ks-castle { left: 50%; bottom: 14%; width: 110px; z-index: 3; }
        .ks-house { left: 22%; bottom: 14%; width: 64px; z-index: 2; }
        .ks-barracks { left: 78%; bottom: 14%; width: 60px; z-index: 2; }
        .ks-villager-l { left: 36%; bottom: 6%; width: 28px; z-index: 4; }
        .ks-villager-r { left: 64%; bottom: 6%; width: 28px; z-index: 4; }
        .ks-tree-front { left: 14%; bottom: 6%; width: 30px; z-index: 5; }
      `}</style>
    </div>
  );
}

