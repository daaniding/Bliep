'use client';

import { useEffect, useState } from 'react';
import { loadFreeChest, msUntilReady, isReady } from '@/lib/freeChest';
import { useStreak } from '@/lib/useStreak';

/**
 * HomeAtmosphere — ambient layer that sits on top of the video hero.
 * Three things happen here:
 *
 *  1. Drifting ember particles (CSS-only) so the scene feels alive
 *  2. A "next chest" chip floating under the HUD with a live countdown
 *  3. A herald speech bubble bottom-left that cycles friendly lines
 *     driven by actual game state (streak + chest readiness)
 *
 * No background of its own — it's transparent and pointer-events are
 * only enabled on the chips themselves so the video / CTA below stay
 * tappable.
 */

const EMBERS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 83 + 7) % 100}%`,
  size: 2 + ((i * 3) % 4),
  duration: 7 + ((i * 1.7) % 5),
  delay: -((i * 0.6) % 7),
  hue: (i % 3 === 0) ? 'warm' : 'pale',
}));

const IDLE_LINES = [
  'Sire, uw rijk gedijt.',
  'De wacht houdt stand.',
  'Het volk wacht op uw bevel.',
  'De torens zijn stevig.',
  'De schatkist glinstert zacht.',
];

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}u ${m.toString().padStart(2, '0')}m`;
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

export default function HomeAtmosphere() {
  const streak = useStreak();
  const [chestMs, setChestMs] = useState<number>(0);
  const [chestReady, setChestReady] = useState<boolean>(false);
  const [lineIdx, setLineIdx] = useState(0);

  // Live tick the chest countdown every second.
  useEffect(() => {
    const tick = () => {
      const state = loadFreeChest();
      setChestReady(isReady(state));
      setChestMs(msUntilReady(state));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Cycle idle herald lines every 7 seconds.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % IDLE_LINES.length);
    }, 7000);
    return () => clearInterval(id);
  }, []);

  // Priority of herald messages: chest ready > streak > idle cycle.
  const heraldLine = chestReady
    ? '🎁 Een kist wacht op u, sire!'
    : streak.current >= 3
      ? `🔥 ${streak.current} dagen op rij — houd vol!`
      : IDLE_LINES[lineIdx];

  return (
    <div className="atmos">
      {/* ---- Embers ---- */}
      <div className="embers">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={`ember ember-${e.hue}`}
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ---- Chest chip ---- */}
      <div className={`chest-chip ${chestReady ? 'ready' : ''}`}>
        <span className="chest-icon">🎁</span>
        <span className="chest-label font-display">
          {chestReady ? 'KLAAR' : formatMs(chestMs)}
        </span>
      </div>

      {/* ---- Herald bubble ---- */}
      <div className="herald">
        <div className="herald-avatar" aria-hidden>🛡️</div>
        <div className="herald-bubble font-body">{heraldLine}</div>
      </div>

      <style jsx>{`
        .atmos {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }

        /* ---- Embers ---- */
        .embers {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .ember {
          position: absolute;
          bottom: -10px;
          border-radius: 50%;
          filter: blur(0.5px);
          animation-name: emberRise;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
          will-change: transform, opacity;
        }
        .ember-warm {
          background: radial-gradient(circle, #ffd27a 0%, rgba(255, 120, 40, 0.7) 50%, rgba(255, 80, 20, 0) 100%);
          box-shadow: 0 0 6px rgba(255, 160, 60, 0.8);
        }
        .ember-pale {
          background: radial-gradient(circle, #fff6dc 0%, rgba(255, 220, 140, 0.6) 50%, rgba(255, 200, 100, 0) 100%);
          box-shadow: 0 0 5px rgba(255, 220, 140, 0.6);
        }
        @keyframes emberRise {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 0.95; }
          60%  { opacity: 0.8; transform: translate(12px, -180px) scale(1); }
          100% { transform: translate(-8px, -360px) scale(0.4); opacity: 0; }
        }

        /* ---- Chest chip (live countdown to next free chest) ---- */
        .chest-chip {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 86px);
          right: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px 7px 9px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.92) 0%, rgba(22, 10, 2, 0.92) 100%);
          border: 2px solid #6e4c10;
          box-shadow:
            inset 0 1px 0 rgba(255, 220, 140, 0.25),
            0 3px 0 #2a1a0a,
            0 6px 14px rgba(0, 0, 0, 0.6);
          color: #fdd069;
          pointer-events: auto;
          animation: chipFadeIn 600ms ease-out 200ms both;
        }
        .chest-chip.ready {
          background: linear-gradient(180deg, #fff6dc 0%, #fdd069 25%, #f0b840 60%, #c8891e 100%);
          color: #2a1505;
          border-color: #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.85),
            inset 0 -2px 0 rgba(90, 45, 0, 0.55),
            0 3px 0 #6e4c10,
            0 8px 18px rgba(240, 184, 64, 0.55),
            0 0 24px rgba(240, 184, 64, 0.7);
          animation: chestReadyPulse 1.5s ease-in-out infinite;
        }
        .chest-icon { font-size: 16px; line-height: 1; }
        .chest-label {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
        }
        .chest-chip.ready .chest-label {
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        @keyframes chipFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chestReadyPulse {
          0%, 100% { transform: scale(1);     box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -2px 0 rgba(90,45,0,0.55), 0 3px 0 #6e4c10, 0 8px 18px rgba(240,184,64,0.55), 0 0 24px rgba(240,184,64,0.7); }
          50%      { transform: scale(1.06);  box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -2px 0 rgba(90,45,0,0.55), 0 3px 0 #6e4c10, 0 10px 22px rgba(240,184,64,0.7),  0 0 36px rgba(240,184,64,0.9); }
        }

        /* ---- Herald bubble ---- */
        .herald {
          position: absolute;
          left: 12px;
          bottom: 150px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: heraldFloat 4.5s ease-in-out infinite, chipFadeIn 800ms ease-out 400ms both;
          pointer-events: none;
          max-width: 68%;
        }
        .herald-avatar {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #5c3a1e, #1a0f05 80%);
          border: 2px solid #6e4c10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.7);
        }
        .herald-bubble {
          position: relative;
          padding: 7px 11px;
          background: linear-gradient(180deg, rgba(40, 20, 5, 0.95) 0%, rgba(22, 10, 2, 0.95) 100%);
          border: 2px solid #6e4c10;
          border-radius: 10px;
          color: #fdd069;
          font-size: 11.5px;
          line-height: 1.25;
          max-width: 220px;
          box-shadow:
            inset 0 1px 0 rgba(255, 220, 140, 0.2),
            0 4px 10px rgba(0, 0, 0, 0.6);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
          animation: bubblePop 380ms ease-out both;
        }
        .herald-bubble::before {
          content: '';
          position: absolute;
          left: -8px;
          bottom: 11px;
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 8px solid #6e4c10;
        }
        .herald-bubble::after {
          content: '';
          position: absolute;
          left: -5px;
          bottom: 12px;
          width: 0;
          height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-right: 6px solid rgba(30, 14, 3, 0.95);
        }
        @keyframes heraldFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes bubblePop {
          from { opacity: 0; transform: translateX(-6px) scale(0.92); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ember, .herald, .chest-chip, .chest-chip.ready, .herald-bubble {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
