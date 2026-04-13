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
  /** Hide the bottom nav (e.g. for full-screen experiences like /stad) */
  hideNav?: boolean;
  /** Hide the top bar (e.g. for splash, login, signup) */
  hideTopBar?: boolean;
}

const NAV_ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L12 4l9 8" /><path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/stad',
    label: 'Stad',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V8l4-3 4 3v13M11 21V11l4-3 4 3v10M3 21h18" />
      </svg>
    ),
  },
  {
    href: '/aanvallen',
    label: 'Aanval',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 6l4 4-9 9-4-4 9-9zM18 2l4 4-2 2-4-4 2-2zM6 14l4 4" />
      </svg>
    ),
  },
  {
    href: '/league',
    label: 'League',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 01-12 0V4zM4 4h2v2a3 3 0 003 3M20 4h-2v2a3 3 0 01-3 3" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Meer',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
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
          <ul className="flex items-center justify-around max-w-md mx-auto">
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all active:scale-90 ${
                      active
                        ? 'text-[var(--color-gold-200)]'
                        : 'text-[var(--color-night-500)] hover:text-[var(--color-gold-300)]'
                    }`}
                  >
                    <div className={active ? 'drop-shadow-[0_2px_8px_rgba(232,184,74,0.6)]' : ''}>
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-display font-bold uppercase tracking-wider">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
