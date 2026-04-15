'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import StoneArchNav from './StoneArchNav';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  hideTopBar?: boolean;
}

export default function GameShell({ children, hideNav = false, hideTopBar = false }: Props) {
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const streak = useStreak();

  const xp = 46;
  const xpMax = 100;
  const level = 2;

  return (
    <div className="app-shell">

      {/* ── CLASH ROYALE TOP BAR ── */}
      {!hideTopBar && (
        <div className="cr-topbar">

          {/* Left: level badge + nameplate with XP bar */}
          <Link href="/settings" className="cr-nameplate">
            <div className="cr-level-badge">
              <span>{level}</span>
            </div>
            <div className="cr-name-block">
              <div className="cr-name-row">
                <span className="cr-name">DAAN</span>
                <img src="/assets/icons/trophy.png" alt="" className="cr-mini-icon" />
                <span className="cr-mini-val">{trophies}</span>
              </div>
              <div className="cr-xp-track">
                <div className="cr-xp-fill" style={{ width: `${(xp / xpMax) * 100}%` }} />
                <span className="cr-xp-text">{xp}/{xpMax}</span>
              </div>
            </div>
          </Link>

          {/* Right: gold chip + gems chip + menu */}
          <div className="cr-top-right">
            <div className="cr-chip cr-chip-gold">
              <img src="/assets/icons/coins.png" alt="" />
              <span>{coins}</span>
              <span className="cr-chip-plus">+</span>
            </div>
            {streak.current > 0 && (
              <div className="cr-chip cr-chip-streak">
                <span className="cr-chip-icon">🔥</span>
                <span>{streak.current}</span>
              </div>
            )}
            <Link href="/settings" className="cr-menu-btn" aria-label="Menu">
              <span></span><span></span><span></span>
            </Link>
          </div>

        </div>
      )}

      <div className="content-stack relative z-10">
        {children}
      </div>

      {!hideNav && <StoneArchNav />}
    </div>
  );
}
