'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import StoneArchNav from './StoneArchNav';
import KingdomLevelBar from './KingdomLevelBar';
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

  return (
    <div className="app-shell">

      {/* ── CLASH ROYALE TOP BAR ── */}
      {!hideTopBar && (
        <div className="cr-topbar">

          {/* Profiel links */}
          <Link href="/settings" className="cr-profile">
            <div className="cr-avatar">🧑</div>
            <div className="cr-profile-info">
              <span className="cr-profile-name">Daan</span>
              <span className="cr-profile-lvl">LVL 1</span>
            </div>
          </Link>

          {/* XP balk midden */}
          <div className="cr-xp-center">
            <KingdomLevelBar />
          </div>

          {/* Resources + settings rechts */}
          <div className="cr-top-right">
            <div className="cr-resources">
              <div className="cr-res-pill cr-res-gold">
                <span className="cr-res-icon">🪙</span>
                <span className="cr-res-val">{coins}</span>
              </div>
              <a href="/league" className="cr-res-pill cr-res-trophy">
                <span className="cr-res-icon">🏆</span>
                <span className="cr-res-val">{trophies}</span>
              </a>
              {streak.current > 0 && (
                <div className="cr-res-pill cr-res-streak">
                  <span className="cr-res-icon">🔥</span>
                  <span className="cr-res-val">{streak.current}</span>
                </div>
              )}
            </div>
            <Link href="/settings" className="cr-settings-btn">⚙️</Link>
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
