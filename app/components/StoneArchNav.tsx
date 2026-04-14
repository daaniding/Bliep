'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { loadDailyPick } from '@/lib/dailyTasks';
import { loadFreeChest, isReady as chestReady } from '@/lib/freeChest';
import {
  CastleIcon,
  ScrollIcon,
  SwordIcon,
  TrophyIcon,
} from './icons/GameIcons';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  center?: boolean;
}

/**
 * Bottom nav — Warm Royal, with real Kenney buttonSquare PNGs as
 * the tab chrome. The OPDRACHT centre tab is raised and lights up
 * with a beige PNG instead of a hand-rolled gradient.
 */
const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" width="26" height="26">
        <path d="M5 16 L16 5 L27 16 L27 26 Q27 28 25 28 L7 28 Q5 28 5 26 Z" fill="#c08038" stroke="#0d0208" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 28 L13 19 Q13 18 14 18 L18 18 Q19 18 19 19 L19 28 Z" fill="#0d0208" />
        <path d="M5 16 L16 5 L27 16" stroke="#fff6dc" strokeWidth="1.4" fill="none" opacity="0.7" />
      </svg>
    ),
  },
  { href: '/stad', label: 'Stad', icon: <CastleIcon size={26} /> },
  { href: '/opdracht', label: 'Opdracht', center: true, icon: <ScrollIcon size={34} /> },
  { href: '/aanvallen', label: 'Aanval', icon: <SwordIcon size={26} /> },
  { href: '/league', label: 'League', icon: <TrophyIcon size={26} /> },
];

export default function StoneArchNav() {
  const pathname = usePathname();
  const [questBadge, setQuestBadge] = useState(false);
  const [chestBadge, setChestBadge] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const pick = loadDailyPick();
      setQuestBadge(!pick.completed);
      setChestBadge(chestReady(loadFreeChest()));
    };
    refresh();
    const id = window.setInterval(refresh, 1500);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <nav className="cr-nav">
      <div className="cr-nav-bar" />
      <div className="cr-nav-row">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const showBadge =
            (item.href === '/' && (questBadge || chestBadge)) ||
            (item.href === '/opdracht' && questBadge);

          // Every tab uses kenney-btn-square-* as the base. Active
          // and center tabs get the beige PNG instead of brown.
          const squareVariant =
            item.center || active ? 'beige' : 'brown';
          const centerClass = item.center ? 'cr-tab-center' : '';
          const activeClass = active ? 'cr-tab-active' : '';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`kenney-btn-square kenney-btn-square-${squareVariant} cr-tab ${centerClass} ${activeClass}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="cr-tab-icon">
                {item.icon}
                {showBadge && <span className="cr-badge" aria-hidden />}
              </span>
              <span className="cr-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .cr-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          pointer-events: none;
        }
        .cr-nav-bar {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(61, 18, 32, 0.96) 0%, rgba(13, 2, 8, 0.98) 100%);
          border-top: 2px solid rgba(240, 184, 64, 0.6);
          box-shadow:
            inset 0 1px 0 rgba(240, 184, 64, 0.4),
            0 -8px 22px rgba(0, 0, 0, 0.75);
          pointer-events: auto;
        }
        .cr-nav-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url('/assets/ui/panel-wood-plank.png');
          background-size: 256px 256px;
          background-repeat: repeat;
          opacity: 0.14;
          mix-blend-mode: overlay;
          pointer-events: none;
        }
        .cr-nav-row {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr 1.25fr 1fr 1fr;
          gap: 6px;
          padding: 14px 10px 16px;
          max-width: 480px;
          margin: 0 auto;
          pointer-events: auto;
          align-items: end;
        }
        .cr-tab-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.85));
        }
        .cr-tab-label {
          line-height: 1;
          margin-top: 1px;
        }
        .cr-tab-active .cr-tab-icon {
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.85))
                  drop-shadow(0 0 6px rgba(255, 220, 140, 0.9));
          transform: scale(1.08);
        }

        /* ===== Centre OPDRACHT tab ===== */
        .cr-tab-center {
          margin-top: -28px;
          min-height: 84px !important;
          padding-top: 14px !important;
          padding-bottom: 18px !important;
          z-index: 2;
          filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.7))
                  drop-shadow(0 0 20px rgba(255, 220, 120, 0.7)) !important;
        }
        .cr-tab-center .cr-tab-icon {
          width: 44px;
          height: 44px;
        }

        /* ===== Notification badge ===== */
        .cr-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #ff6a4a 0%, #c0392b 55%, #7a1e0a 100%);
          border: 2px solid #fff6dc;
          box-shadow:
            0 0 10px rgba(230, 40, 20, 0.95),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          z-index: 4;
          animation: crBadgePulse 1.6s ease-in-out infinite;
        }
        @keyframes crBadgePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
      `}</style>
    </nav>
  );
}
