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
  const passProgress = 2;
  const passMax = 10;

  return (
    <div className="app-shell">

      {/* ── HEADER CLUSTER ── 3 rows of pills (CR style) */}
      {!hideTopBar && (
        <div className="cr-header">

          {/* ROW 1 — resource pills right-aligned: XP · coins · gems */}
          <div className="cr-header-row cr-header-row-right">
            <div className="cr-pill cr-pill-xp">
              <div className="cr-pill-badge cr-pill-badge-blue">{level}</div>
              <div className="cr-bar">
                <div className="cr-bar-fill cr-bar-fill-blue" style={{ width: `${(xp / xpMax) * 100}%` }} />
                <span className="cr-bar-text">{xp}/{xpMax}</span>
              </div>
            </div>
            <div className="cr-pill cr-pill-coins">
              <img src="/assets/icons/coins.png" alt="" />
              <span>{coins}</span>
            </div>
            <div className="cr-pill cr-pill-gems">
              <img src="/assets/icons/star.png" alt="" />
              <span>{streak.current || 0}</span>
            </div>
          </div>

          {/* ROW 2 — Name+trophies LEFT, Pass Royale RIGHT */}
          <div className="cr-header-row">
            <div className="cr-pill cr-pill-name">
              <div className="cr-avatar-sm">🧑</div>
              <div className="cr-name-col">
                <span className="cr-name-label">DAAN</span>
                <div className="cr-name-row">
                  <img src="/assets/icons/trophy.png" alt="" className="cr-inline-icon" />
                  <span>{trophies}</span>
                </div>
              </div>
            </div>
            <div className="cr-pill cr-pill-pass">
              <div className="cr-pill-badge cr-pill-badge-gold">{passProgress}</div>
              <span className="cr-pass-label">Pass</span>
              <div className="cr-bar">
                <div className="cr-bar-fill cr-bar-fill-gold" style={{ width: `${(passProgress / passMax) * 100}%` }} />
                <span className="cr-bar-text">{passProgress}/{passMax}</span>
              </div>
            </div>
          </div>

          {/* ROW 3 — 4 quick action rectangles: settings, streak, gratis kist, league */}
          <div className="cr-header-row cr-header-row-right">
            <Link href="/settings" className="cr-action">
              <div className="cr-action-icon">⚙️</div>
              <span>Instel</span>
            </Link>
            <button type="button" className="cr-action">
              <div className="cr-action-icon">🔥</div>
              {streak.current > 0 && <span className="cr-action-badge">{streak.current}</span>}
              <span>Streak</span>
            </button>
            <button type="button" className="cr-action">
              <div className="cr-action-icon">🎁</div>
              <span className="cr-action-badge cr-badge-red">1</span>
              <span>Kist</span>
            </button>
            <Link href="/league" className="cr-action">
              <div className="cr-action-icon">🏆</div>
              <span>League</span>
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
