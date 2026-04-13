'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import GameChip from './GameChip';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { useStreak } from '@/lib/useStreak';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  hideTopBar?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  sprite: string;
  big?: boolean;
}

// Shop-style nav: Cards / Stad / BATTLE (big center) / League / Shop
// Each tab is a Kenney square button with a structure/unit sprite inside.
const NAV_ITEMS: NavItem[] = [
  { href: '/',          label: 'Home',    sprite: '/assets/kenney/environment/medievalEnvironment_01.png' },
  { href: '/stad',      label: 'Stad',    sprite: '/assets/kenney/buildings/medievalStructure_17.png' },
  { href: '/aanvallen', label: 'Battle',  sprite: '/assets/kenney/units/medievalUnit_01.png', big: true },
  { href: '/league',    label: 'League',  sprite: '/assets/kenney/units/medievalUnit_05.png' },
  { href: '/settings',  label: 'Meer',    sprite: '/assets/kenney/units/medievalUnit_10.png' },
];

export default function GameShell({ children, hideNav = false, hideTopBar = false }: Props) {
  const pathname = usePathname();
  const { coins } = useCoins();
  const { trophies } = useTrophies();
  const streak = useStreak();

  return (
    <div className="app-shell relative">
      {!hideTopBar && (
        <div className="top-bar flex items-center justify-between gap-2">
          <GameChip variant="gold" value={coins} icon="🪙" />
          <div className="flex items-center gap-2">
            {streak.current > 0 && (
              <GameChip variant="streak" value={streak.current} icon="🔥" />
            )}
            <GameChip variant="trophy" value={trophies} icon="🏆" href="/league" />
          </div>
        </div>
      )}

      <div className="relative z-10">
        {children}
      </div>

      {!hideNav && (
        <nav className="bottom-nav">
          <ul className="flex items-end justify-around max-w-md mx-auto gap-1 px-1">
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.href} className={item.big ? 'relative -mt-6' : ''}>
                  <NavTab item={item} active={active} />
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const squareClass = item.big
    ? 'kenney-btn-square'
    : active
      ? 'kenney-btn-square'
      : 'kenney-btn-square kenney-btn-square-brown';

  const scale = item.big ? 'scale-[1.25]' : '';
  const spriteSize = item.big ? 52 : 36;

  return (
    <Link href={item.href} className={`inline-block active:scale-90 transition-transform ${scale}`}>
      <div
        className={`${squareClass} ${active && !item.big ? 'ring-4 ring-[var(--color-gold-300)]/60 rounded-sm' : ''}`}
        style={item.big ? { filter: 'drop-shadow(0 4px 10px rgba(232, 184, 74, 0.5))' } : undefined}
      >
        <img
          src={item.sprite}
          alt=""
          className="sprite-pixel"
          style={{ width: spriteSize, height: spriteSize, imageRendering: 'pixelated' }}
        />
        <span className={item.big ? 'text-[11px]' : 'text-[9px]'}>{item.label}</span>
      </div>
    </Link>
  );
}
