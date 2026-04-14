'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CityPreview from './CityPreview';
import {
  CoinIcon,
  TrophyIcon,
  FlameIcon,
  SwordIcon,
  ChestIcon,
  LockIcon,
} from './icons/GameIcons';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';
import {
  loadFreeChest,
  msUntilReady,
  isReady as chestReady,
} from '@/lib/freeChest';
import { sfxTap } from '@/lib/sound';

/**
 * GameDashboard — Clash Royale style home:
 *
 *  ┌──────────────────────────────┐
 *  │  player banner (tap → /meer)  │
 *  │  [miniature stad preview]     │
 *  │  streak · coins · trophies    │
 *  │  ┌────────────────────────┐   │
 *  │  │   ⚔  BATTLE  ⚔        │   │
 *  │  └────────────────────────┘   │
 *  │  chest slots · ♦ ♦ ♦ ♦        │
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

export default function GameDashboard() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const streak = useStreak();
  const [displayName, setDisplayName] = useState('Held');
  const [chestMs, setChestMs] = useState<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem('bliep:displayName');
      if (n && n.trim()) setDisplayName(n.trim());
    } catch { /* ignore */ }

    const refresh = () => setChestMs(msUntilReady(loadFreeChest()));
    refresh();
    tickRef.current = window.setInterval(refresh, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // Coin progress: next milestone in steps of 500
  const nextMilestone = Math.max(500, (Math.floor(coins / 500) + 1) * 500);
  const prevMilestone = nextMilestone - 500;
  const coinPct = Math.max(
    0,
    Math.min(1, (coins - prevMilestone) / (nextMilestone - prevMilestone)),
  );

  const chestAvailable = chestReady(loadFreeChest());

  return (
    <div className="gd-root">
      {/* ===== Player banner ===== */}
      <Link
        href="/meer"
        onClick={() => sfxTap()}
        className="gd-banner animate-fade-up"
        style={{ animationDelay: '40ms' }}
      >
        <div className="gd-banner-avatar">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <circle cx="16" cy="13" r="6" fill="#f0b840" stroke="#1a0f05" strokeWidth="2" />
            <path d="M6 28 Q6 20 16 20 Q26 20 26 28 Z" fill="#c0392b" stroke="#1a0f05" strokeWidth="2" />
            <circle cx="14" cy="13" r="1" fill="#1a0f05" />
            <circle cx="18" cy="13" r="1" fill="#1a0f05" />
          </svg>
        </div>
        <div className="gd-banner-body">
          <span className="gd-banner-label">VORST</span>
          <span className="gd-banner-name font-display">{displayName}</span>
        </div>
        <div className="gd-banner-chevron">›</div>
      </Link>

      {/* ===== City miniature ===== */}
      <div
        className="gd-city animate-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        <div className="gd-city-wrap">
          <CityPreview />
        </div>
      </div>

      {/* ===== Stats row ===== */}
      <div className="gd-stats">
        <div
          className="gd-chip animate-fade-up"
          style={{ animationDelay: '180ms' }}
        >
          <FlameIcon size={22} />
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">{streak.current}</span>
            <span className="gd-chip-label">streak</span>
          </div>
        </div>

        <div
          className="gd-chip gd-chip-coin animate-fade-up"
          style={{ animationDelay: '240ms' }}
        >
          <CoinIcon size={22} />
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">
              {coins.toLocaleString('nl-NL')}
            </span>
            <div className="gd-chip-bar">
              <div
                className="gd-chip-bar-fill"
                style={{ width: `${Math.round(coinPct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div
          className="gd-chip animate-fade-up"
          style={{ animationDelay: '300ms' }}
        >
          <TrophyIcon size={22} />
          <div className="gd-chip-body">
            <span className="gd-chip-value font-display">{trophies}</span>
            <span className="gd-chip-label">trofeeën</span>
          </div>
        </div>
      </div>

      {/* ===== BATTLE button ===== */}
      <Link
        href="/battle"
        onClick={() => sfxTap()}
        className="gd-battle animate-fade-up"
        style={{ animationDelay: '360ms' }}
      >
        <span className="gd-battle-inner">
          <SwordIcon size={28} />
          <span className="gd-battle-label font-display">BATTLE</span>
          <SwordIcon size={28} style={{ transform: 'scaleX(-1)' }} />
        </span>
      </Link>

      {/* ===== Chest slots ===== */}
      <div className="gd-chests animate-fade-up" style={{ animationDelay: '420ms' }}>
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
              className={`gd-chest ${active ? 'gd-chest-ready' : ''}`}
              aria-label={isFirst ? 'Gratis kist' : 'Kist-slot vergrendeld'}
            >
              {isFirst ? (
                <ChestIcon size={38} />
              ) : (
                <>
                  <ChestIcon size={34} style={{ opacity: 0.4 }} />
                  <span className="gd-chest-lock">
                    <LockIcon size={18} />
                  </span>
                </>
              )}
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
          padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px
            calc(env(safe-area-inset-bottom, 0px) + 120px);
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 100dvh;
        }

        /* ===== Banner ===== */
        .gd-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 14px 8px 8px;
          border-radius: 16px;
          background: linear-gradient(
            180deg,
            #2a1a0e 0%,
            #1a0f05 100%
          );
          border: 3px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(240, 184, 64, 0.45),
            inset 0 -2px 0 rgba(0, 0, 0, 0.6),
            0 3px 0 #0d0a06,
            0 6px 16px rgba(0, 0, 0, 0.55);
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }
        .gd-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            rgba(240, 184, 64, 0) 30%,
            rgba(255, 220, 140, 0.12) 50%,
            rgba(240, 184, 64, 0) 70%
          );
          pointer-events: none;
        }
        .gd-banner-avatar {
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #2a1505, #0d0a06);
          border: 2.5px solid #fdd069;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.7);
        }
        .gd-banner-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .gd-banner-label {
          font-size: 9px;
          letter-spacing: 0.16em;
          color: #fdd069;
          opacity: 0.75;
          text-transform: uppercase;
          font-weight: 700;
        }
        .gd-banner-name {
          font-size: 18px;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0a06;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gd-banner-chevron {
          color: #fdd069;
          font-size: 26px;
          font-family: var(--font-display), system-ui, sans-serif;
          text-shadow: 0 1.5px 0 #0d0a06;
          padding-right: 4px;
        }

        /* ===== City ===== */
        .gd-city {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 180px;
        }
        .gd-city-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        /* ===== Stats ===== */
        .gd-stats {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 8px;
        }
        .gd-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 14px;
          background: linear-gradient(
            180deg,
            #2a1a0e 0%,
            #1a0f05 100%
          );
          border: 2.5px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(240, 184, 64, 0.4),
            inset 0 -2px 0 rgba(0, 0, 0, 0.6),
            0 3px 0 #0d0a06,
            0 5px 10px rgba(0, 0, 0, 0.5);
          min-height: 48px;
        }
        .gd-chip-body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          flex: 1;
        }
        .gd-chip-value {
          font-size: 17px;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #0d0a06;
          line-height: 1;
        }
        .gd-chip-label {
          font-size: 9px;
          letter-spacing: 0.12em;
          color: #fdd069;
          opacity: 0.75;
          text-transform: uppercase;
          margin-top: 3px;
        }
        .gd-chip-bar {
          height: 5px;
          border-radius: 4px;
          background: #0d0a06;
          border: 1px solid #0d0a06;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
          margin-top: 5px;
          overflow: hidden;
        }
        .gd-chip-bar-fill {
          height: 100%;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #fdd069 35%,
            #f0b840 75%,
            #c8891e 100%
          );
          box-shadow: 0 0 8px rgba(240, 184, 64, 0.8);
          transition: width 400ms ease-out;
        }

        /* ===== Battle ===== */
        .gd-battle {
          display: block;
          text-decoration: none;
          padding: 4px;
          border-radius: 22px;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #fdd069 12%,
            #f0b840 35%,
            #8a5a10 100%
          );
          border: 4px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.85),
            inset 0 -3px 0 rgba(60, 20, 0, 0.5),
            0 5px 0 #3d0a00,
            0 10px 22px rgba(0, 0, 0, 0.7),
            0 0 30px rgba(240, 184, 64, 0.55);
          animation: battlePulse 1.8s ease-in-out infinite;
          transition: transform 120ms ease-out;
        }
        .gd-battle:active {
          transform: scale(0.97);
        }
        .gd-battle-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 16px 20px;
          border-radius: 17px;
          background: linear-gradient(
            180deg,
            #e8541b 0%,
            #c0392b 45%,
            #7a1e0a 100%
          );
          border: 2px solid #0d0a06;
          box-shadow:
            inset 0 2px 0 rgba(255, 220, 140, 0.55),
            inset 0 -3px 0 rgba(30, 5, 0, 0.8);
          min-height: 66px;
        }
        .gd-battle-label {
          font-size: 28px;
          color: #fff6dc;
          letter-spacing: 0.1em;
          text-shadow:
            0 2px 0 #3d0a00,
            0 4px 6px rgba(0, 0, 0, 0.6);
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
          gap: 4px;
          padding: 10px 4px 6px;
          border-radius: 13px;
          background: linear-gradient(
            180deg,
            #2a1a0e 0%,
            #1a0f05 100%
          );
          border: 2.5px solid #0d0a06;
          box-shadow:
            inset 0 1.5px 0 rgba(240, 184, 64, 0.35),
            inset 0 -2px 0 rgba(0, 0, 0, 0.6),
            0 3px 0 #0d0a06,
            0 4px 8px rgba(0, 0, 0, 0.5);
          text-decoration: none;
          min-height: 68px;
          transition: transform 120ms ease-out;
        }
        .gd-chest:active {
          transform: scale(0.95);
        }
        .gd-chest-ready {
          background: linear-gradient(180deg, #3d2410 0%, #1a0f05 100%);
          box-shadow:
            inset 0 1.5px 0 rgba(255, 220, 140, 0.65),
            inset 0 -2px 0 rgba(0, 0, 0, 0.6),
            0 3px 0 #0d0a06,
            0 4px 8px rgba(0, 0, 0, 0.5),
            0 0 22px rgba(240, 184, 64, 0.7);
          animation: chestShake 4s ease-in-out infinite;
        }
        .gd-chest-caption {
          font-size: 10px;
          color: #fdd069;
          letter-spacing: 0.1em;
          text-shadow: 0 1px 0 #0d0a06;
          text-transform: uppercase;
          line-height: 1;
        }
        .gd-chest-lock {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%);
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.9));
        }

        /* ===== Animations ===== */
        @keyframes battlePulse {
          0%, 100% {
            box-shadow:
              inset 0 2px 0 rgba(255, 255, 255, 0.85),
              inset 0 -3px 0 rgba(60, 20, 0, 0.5),
              0 5px 0 #3d0a00,
              0 10px 22px rgba(0, 0, 0, 0.7),
              0 0 28px rgba(240, 184, 64, 0.5);
          }
          50% {
            box-shadow:
              inset 0 2px 0 rgba(255, 255, 255, 0.85),
              inset 0 -3px 0 rgba(60, 20, 0, 0.5),
              0 5px 0 #3d0a00,
              0 10px 24px rgba(0, 0, 0, 0.7),
              0 0 44px rgba(255, 180, 60, 0.85);
          }
        }
        @keyframes chestShake {
          0%, 88%, 100% { transform: translateX(0) rotate(0deg); }
          90%           { transform: translateX(-2px) rotate(-3deg); }
          92%           { transform: translateX(2px) rotate(3deg); }
          94%           { transform: translateX(-2px) rotate(-2deg); }
          96%           { transform: translateX(2px) rotate(2deg); }
        }
        .animate-fade-up {
          opacity: 0;
          transform: translateY(8px);
          animation: fadeUp 500ms ease-out forwards;
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
