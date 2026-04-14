'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import {
  CoinIcon,
  GemIcon,
  TrophyIcon,
  ShieldIcon,
  StarIcon,
  GearIcon,
} from './icons/GameIcons';
import { loadCity } from '@/lib/cityStore';

/**
 * TopHud — Clash Royale style two-row HUD.
 *
 *   row 1: [LVL · XP bar]   [coins]      [gems]
 *   row 2: [avatar · name · rank]        [trophies] [gear]
 */

type Rank = { label: string; col: string; ring: string; min: number };
const RANKS: Rank[] = [
  { label: 'Brons',  col: '#9b6838', ring: '#d19225', min: 0 },
  { label: 'Zilver', col: '#b8c0c8', ring: '#e8edf2', min: 100 },
  { label: 'Goud',   col: '#f0b840', ring: '#fff6dc', min: 500 },
];
function rankFor(t: number): Rank {
  return [...RANKS].reverse().find((r) => t >= r.min) ?? RANKS[0];
}

export default function TopHud() {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const [displayName, setDisplayName] = useState('Held');
  const [buildings, setBuildings] = useState(1);

  useEffect(() => {
    try {
      const n = localStorage.getItem('bliep:displayName');
      if (n && n.trim()) setDisplayName(n.trim());
    } catch { /* ignore */ }

    const refresh = () => {
      const c = loadCity();
      setBuildings(Math.max(1, c.buildings.length));
    };
    refresh();
    const id = window.setInterval(refresh, 2000);
    return () => window.clearInterval(id);
  }, []);

  const level = buildings;
  // XP placeholder: progress toward next building (mod 1 = 0 for now).
  const xpPct = 0.35;

  // Gems placeholder — Bliep doesn't track gems yet.
  const gems = 0;

  const rank = useMemo(() => rankFor(trophies), [trophies]);

  return (
    <div className="th-wrap">
      {/* ===== Row 1: level · coins · gems ===== */}
      <div className="th-row">
        <Link href="/meer" className="th-cell th-cell-left">
          <span className="th-icon-frame">
            <StarIcon size={20} />
          </span>
          <div className="th-cell-body">
            <div className="th-cell-top">
              <span className="th-label font-display">LVL</span>
              <span className="th-value font-display">{level}</span>
            </div>
            <div className="th-xp">
              <div className="th-xp-fill" style={{ width: `${Math.round(xpPct * 100)}%` }} />
              <div className="th-xp-shine" />
            </div>
          </div>
        </Link>

        <div className="th-cell">
          <span className="th-icon-frame">
            <CoinIcon size={20} />
          </span>
          <span className="th-value font-display">{coins.toLocaleString('nl-NL')}</span>
        </div>

        <div className="th-cell">
          <span className="th-icon-frame">
            <GemIcon size={20} />
          </span>
          <span className="th-value font-display">{gems}</span>
        </div>
      </div>

      {/* ===== Row 2: avatar · rank · trophies · gear ===== */}
      <div className="th-row th-row-bottom">
        <Link href="/meer" className="th-player">
          <div className="th-avatar">
            <svg viewBox="0 0 36 36" width="36" height="36">
              <circle cx="18" cy="14" r="7" fill="#f0b840" stroke="#0a0a0a" strokeWidth="2" />
              <path d="M5 32 Q5 22 18 22 Q31 22 31 32 Z" fill="#c0392b" stroke="#0a0a0a" strokeWidth="2" />
              <circle cx="15" cy="14" r="1" fill="#0a0a0a" />
              <circle cx="21" cy="14" r="1" fill="#0a0a0a" />
              <path d="M14 17 Q18 19 22 17" stroke="#0a0a0a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="th-player-body">
            <span className="th-player-name font-display">{displayName}</span>
            <span className="th-rank-pill" style={{ ['--rank' as never]: rank.col, ['--rankRing' as never]: rank.ring }}>
              <ShieldIcon size={12} />
              <span className="font-display">{rank.label}</span>
            </span>
          </div>
        </Link>

        <div className="th-right">
          <div className="th-cell th-cell-tight">
            <span className="th-icon-frame">
              <TrophyIcon size={20} />
            </span>
            <span className="th-value font-display">{trophies.toLocaleString('nl-NL')}</span>
          </div>
          <Link href="/settings" className="th-gear" aria-label="Instellingen">
            <GearIcon size={20} />
          </Link>
        </div>
      </div>

      <style jsx>{`
        .th-wrap {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          padding-top: env(safe-area-inset-top, 0px);
          background: linear-gradient(180deg, #061a35 0%, #0a2d54 60%, #0a2d54 100%);
          border-bottom: 2px solid rgba(74, 157, 232, 0.4);
          box-shadow:
            inset 0 -1px 0 rgba(74, 157, 232, 0.3),
            0 6px 16px rgba(0, 0, 0, 0.55);
        }
        .th-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 6px;
          padding: 8px 10px 6px;
          align-items: center;
        }
        .th-row-bottom {
          grid-template-columns: 1.55fr 1fr;
          padding-top: 0;
          padding-bottom: 8px;
          border-top: 1px solid rgba(74, 157, 232, 0.18);
        }

        .th-cell {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 4px;
          min-height: 32px;
          border-radius: 999px;
          background: linear-gradient(180deg, #04132a 0%, #02091a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            inset 0 1.5px 0 rgba(74, 157, 232, 0.55),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 #02091a,
            0 4px 8px rgba(0, 0, 0, 0.55);
          color: #e8f0ff;
          text-decoration: none;
        }
        .th-cell-left {
          padding-right: 12px;
        }
        .th-cell-tight {
          padding: 4px 10px 4px 4px;
        }
        .th-icon-frame {
          flex: 0 0 auto;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 28%, #1a3a6a 0%, #02091a 80%);
          border: 2px solid #4a9de8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            inset 0 0 8px rgba(0, 0, 0, 0.85),
            inset 0 1px 0 rgba(255, 255, 255, 0.25),
            0 1px 0 #02091a;
        }
        .th-cell-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .th-cell-top {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .th-label {
          font-size: 9px;
          letter-spacing: 0.14em;
          color: #4a9de8;
          text-transform: uppercase;
          text-shadow: 0 1px 0 #02091a;
        }
        .th-value {
          font-size: 14px;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #02091a, 0 0 8px rgba(240, 184, 64, 0.35);
          line-height: 1;
        }
        .th-xp {
          position: relative;
          height: 5px;
          border-radius: 4px;
          background: #02091a;
          border: 1px solid #02091a;
          box-shadow: inset 0 1.5px 2px rgba(0, 0, 0, 0.85);
          overflow: hidden;
        }
        .th-xp-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: linear-gradient(180deg, #b8e8ff 0%, #4a9de8 50%, #1a5a9a 100%);
          box-shadow: 0 0 8px rgba(74, 157, 232, 0.9);
        }
        .th-xp-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
          transform: translateX(-100%);
          animation: thShine 4s ease-in-out infinite;
        }
        @keyframes thShine {
          0%, 80% { transform: translateX(-100%); }
          95%, 100% { transform: translateX(100%); }
        }

        /* ===== Player row ===== */
        .th-player {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 999px;
          background: linear-gradient(180deg, #04132a 0%, #02091a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            inset 0 1.5px 0 rgba(74, 157, 232, 0.55),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 #02091a,
            0 4px 8px rgba(0, 0, 0, 0.55);
          text-decoration: none;
          color: #fff6dc;
          min-height: 36px;
          overflow: hidden;
        }
        .th-avatar {
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #1a3a6a 0%, #02091a 80%);
          border: 2px solid #fdd069;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            inset 0 0 8px rgba(0, 0, 0, 0.85),
            0 1px 0 #02091a,
            0 0 10px rgba(240, 184, 64, 0.5);
          overflow: hidden;
        }
        .th-player-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .th-player-name {
          font-size: 13px;
          color: #fff6dc;
          text-shadow: 0 1.5px 0 #02091a;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .th-rank-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px 2px 4px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--rankRing) 0%, var(--rank) 100%);
          border: 1.5px solid #02091a;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(0, 0, 0, 0.4),
            0 1px 0 #02091a;
          font-size: 9px;
          letter-spacing: 0.06em;
          color: #2a1505;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(255, 246, 220, 0.65);
          width: fit-content;
        }
        .th-right {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-end;
        }
        .th-gear {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(180deg, #04132a 0%, #02091a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            inset 0 1.5px 0 rgba(74, 157, 232, 0.55),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 #02091a,
            0 4px 8px rgba(0, 0, 0, 0.55);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
