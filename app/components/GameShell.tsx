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

      {/* ── CLASH ROYALE TOP BAR — two rows of compact pills ── */}
      {!hideTopBar && (
        <div className="cr-topbar">

          {/* All pills in one packed row: level • XP • trophy • coins • gems • menu */}
          <Link href="/settings" className="cr-level-group">
            <div className="cr-level-badge">
              <span>{level}</span>
            </div>
            <div className="cr-xp-pill">
              <div className="cr-xp-track">
                <div className="cr-xp-fill" style={{ width: `${(xp / xpMax) * 100}%` }} />
                <span className="cr-xp-overlay">{xp}/{xpMax}</span>
              </div>
            </div>
          </Link>
          <Link href="/league" className="cr-chip cr-chip-trophy">
            <img src="/assets/icons/trophy.png" alt="" />
            <span>{trophies}</span>
          </Link>
          <div className="cr-chip cr-chip-gold">
            <img src="/assets/icons/coins.png" alt="" />
            <span>{coins}</span>
          </div>
          <div className="cr-chip cr-chip-gem">
            <img src="/assets/icons/star.png" alt="" />
            <span>{streak.current || 0}</span>
          </div>
          <Link href="/settings" className="cr-menu-btn" aria-label="Menu">
            <span></span><span></span><span></span>
          </Link>

        </div>
      )}

      <div className="content-stack relative z-10">
        {children}
      </div>

      {!hideNav && <StoneArchNav />}
    </div>
  );
}
