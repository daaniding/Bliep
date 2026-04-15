'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  center?: boolean;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: <span className="nav-emoji">🏠</span>,
  },
  {
    href: '/stad',
    label: 'Stad',
    badge: 2,
    icon: <span className="nav-emoji">🏰</span>,
  },
  {
    href: '/aanvallen',
    label: 'Battle',
    center: true,
    icon: (
      <svg viewBox="0 0 60 60" fill="none">
        {/* Big shield with crossed swords */}
        <defs>
          <linearGradient id="shieldG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0b840" />
            <stop offset="0.5" stopColor="#d19225" />
            <stop offset="1" stopColor="#6e4c10" />
          </linearGradient>
        </defs>
        <path
          d="M30 4 L52 10 L52 32 Q52 48 30 56 Q8 48 8 32 L8 10 Z"
          fill="url(#shieldG)"
          stroke="#1a0f05"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Inner shield field */}
        <path
          d="M30 10 L46 14 L46 32 Q46 44 30 50 Q14 44 14 32 L14 14 Z"
          fill="#7a1e0a"
          stroke="#1a0f05"
          strokeWidth="2"
        />
        {/* Crossed swords */}
        <g transform="translate(30 32)">
          <g transform="rotate(-45)">
            <rect x="-1.2" y="-16" width="2.4" height="22" fill="#d7d7d7" stroke="#1a0f05" strokeWidth="0.8" />
            <rect x="-3" y="6" width="6" height="2" fill="#f0b840" stroke="#1a0f05" strokeWidth="0.8" />
            <rect x="-1" y="8" width="2" height="5" fill="#f0b840" stroke="#1a0f05" strokeWidth="0.8" />
          </g>
          <g transform="rotate(45)">
            <rect x="-1.2" y="-16" width="2.4" height="22" fill="#d7d7d7" stroke="#1a0f05" strokeWidth="0.8" />
            <rect x="-3" y="6" width="6" height="2" fill="#f0b840" stroke="#1a0f05" strokeWidth="0.8" />
            <rect x="-1" y="8" width="2" height="5" fill="#f0b840" stroke="#1a0f05" strokeWidth="0.8" />
          </g>
        </g>
      </svg>
    ),
  },
  {
    href: '/league',
    label: 'League',
    icon: <span className="nav-emoji">🏆</span>,
  },
  {
    href: '/settings',
    label: 'Meer',
    badge: 1,
    icon: <span className="nav-emoji">⚙️</span>,
  },
];

export default function StoneArchNav() {
  const pathname = usePathname();

  return (
    <nav className="stone-arch-nav">
      {/* Stone arch SVG background */}
      <svg
        className="arch-bg"
        viewBox="0 0 440 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="stoneG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5c3a1e" />
            <stop offset="0.4" stopColor="#3d2813" />
            <stop offset="1" stopColor="#1a0f05" />
          </linearGradient>
          <pattern id="stoneBrick" width="40" height="22" patternUnits="userSpaceOnUse">
            <rect width="40" height="22" fill="url(#stoneG)" />
            <line x1="0" y1="11" x2="40" y2="11" stroke="#1a0f05" strokeWidth="1" opacity="0.6" />
            <line x1="20" y1="0" x2="20" y2="11" stroke="#1a0f05" strokeWidth="1" opacity="0.6" />
            <line x1="0" y1="22" x2="40" y2="22" stroke="#1a0f05" strokeWidth="1" opacity="0.6" />
          </pattern>
        </defs>

        {/* Base stone bar */}
        <path
          d="M0 40 Q60 20 120 32 Q180 44 220 22 Q260 0 300 22 Q360 44 440 32 L440 120 L0 120 Z"
          fill="url(#stoneBrick)"
          stroke="#1a0f05"
          strokeWidth="3"
        />

        {/* Top arch highlight (hidden via .arch-bg display:none) */}
        <path d="M0 0" fill="none" />

        {/* Center keystone (bigger) */}
        <polygon
          points="200,24 240,24 244,60 196,60"
          fill="url(#stoneG)"
          stroke="#1a0f05"
          strokeWidth="2.5"
        />
        <polygon
          points="200,24 240,24 244,60 196,60"
          fill="none"
          stroke="#d19225"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </svg>

      <div className="arch-row">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`arch-tab ${active ? 'active' : ''} ${item.center ? 'center' : ''}`}
            >
              <div className="arch-tab-icon">
                {item.icon}
                {item.badge ? <span className="arch-tab-badge">{item.badge}</span> : null}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
