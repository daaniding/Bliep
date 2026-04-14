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
 * Bottom nav — Clash Royale style.
 *
 *   Home · Stad · OPDRACHT (center, raised) · Aanvallen · League
 */
const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M5 16 L16 5 L27 16 L27 26 Q27 28 25 28 L7 28 Q5 28 5 26 Z" fill="#4a9de8" stroke="#02091a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 28 L13 19 Q13 18 14 18 L18 18 Q19 18 19 19 L19 28 Z" fill="#02091a" />
        <path d="M5 16 L16 5 L27 16" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.7" />
      </svg>
    ),
  },
  {
    href: '/stad',
    label: 'Stad',
    icon: <CastleIcon size={26} />,
  },
  {
    href: '/opdracht',
    label: 'Opdracht',
    center: true,
    icon: <ScrollIcon size={32} />,
  },
  {
    href: '/aanvallen',
    label: 'Aanval',
    icon: <SwordIcon size={26} />,
  },
  {
    href: '/league',
    label: 'League',
    icon: <TrophyIcon size={26} />,
  },
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`cr-tab ${active ? 'active' : ''} ${item.center ? 'center' : ''}`}
            >
              <span className="cr-tab-icon">
                {item.icon}
                {showBadge && <span className="cr-badge" aria-hidden />}
              </span>
              <span className="cr-tab-label font-display">{item.label}</span>
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
          background: linear-gradient(180deg, #071e3d 0%, #03101e 100%);
          border-top: 2px solid rgba(74, 157, 232, 0.45);
          box-shadow:
            inset 0 1px 0 rgba(74, 157, 232, 0.35),
            0 -8px 22px rgba(0, 0, 0, 0.6);
          pointer-events: auto;
        }
        .cr-nav-row {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr 1.2fr 1fr 1fr;
          gap: 6px;
          padding: 12px 10px 14px;
          max-width: 480px;
          margin: 0 auto;
          pointer-events: auto;
          align-items: end;
        }
        .cr-tab {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 6px 4px 6px;
          border-radius: 12px;
          background: linear-gradient(180deg, #0a2d54 0%, #04132a 100%);
          border: 2px solid #1a5a9a;
          box-shadow:
            0 4px 0 #061828,
            0 8px 14px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.6);
          color: #b8d8ff;
          text-decoration: none;
          font-family: var(--font-display), system-ui, sans-serif;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: transform 100ms ease-out;
          min-height: 56px;
        }
        .cr-tab:active { transform: translateY(2px); }
        .cr-tab.active {
          border-color: #f0b840;
          background: linear-gradient(180deg, #143b6a 0%, #0a2349 100%);
          color: #fff6dc;
          box-shadow:
            0 4px 0 #6e4c10,
            0 8px 14px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 246, 220, 0.25),
            inset 0 -1.5px 0 rgba(0, 0, 0, 0.6),
            0 0 22px rgba(240, 184, 64, 0.75);
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
        .cr-tab.active .cr-tab-icon {
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.85))
                  drop-shadow(0 0 6px rgba(255, 220, 140, 0.85));
          transform: scale(1.08);
        }
        .cr-tab-label {
          text-shadow: 0 1px 0 #02091a;
          line-height: 1;
        }
        .cr-tab.active .cr-tab-label {
          text-shadow: 0 1px 0 #02091a, 0 0 8px rgba(240, 184, 64, 0.85);
        }

        /* ===== Center OPDRACHT tab ===== */
        .cr-tab.center {
          margin-top: -22px;
          padding: 8px 4px 8px;
          background: linear-gradient(180deg, #ffe566 0%, #f0c030 30%, #c8891e 70%, #6e4c10 100%);
          border: 3px solid #6e4c10;
          color: #2a1505;
          box-shadow:
            0 6px 0 #3d2800,
            0 10px 22px rgba(0, 0, 0, 0.65),
            inset 0 2px 0 rgba(255, 255, 255, 0.7),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3),
            0 0 24px rgba(240, 184, 64, 0.6);
          min-height: 72px;
          z-index: 2;
        }
        .cr-tab.center.active {
          box-shadow:
            0 6px 0 #3d2800,
            0 10px 22px rgba(0, 0, 0, 0.65),
            inset 0 2px 0 rgba(255, 255, 255, 0.7),
            inset 0 -3px 0 rgba(0, 0, 0, 0.3),
            0 0 36px rgba(255, 220, 100, 0.95);
        }
        .cr-tab.center .cr-tab-icon {
          width: 42px;
          height: 42px;
        }
        .cr-tab.center .cr-tab-label {
          color: #2a1505;
          text-shadow: 0 1px 0 rgba(255, 246, 220, 0.65);
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
