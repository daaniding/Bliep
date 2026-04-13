'use client';

import { ReactNode } from 'react';
import BannerChip from './BannerChip';
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

  return (
    <div className="app-shell">
      {!hideTopBar && (
        <div className="hanging-banner-container">
          <div className="hanging-banner-row">
            <BannerChip variant="gold" value={coins} label="Coins" />
            <div className="banner-group">
              {streak.current > 0 && (
                <BannerChip variant="blood" value={streak.current} label="Streak" />
              )}
              <BannerChip variant="magic" value={trophies} label="Trofee" href="/league" />
            </div>
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
