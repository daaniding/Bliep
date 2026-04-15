'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { vibrate } from '@/lib/juice';

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
    icon: <img src="/assets/icons-rpg/home.png" alt="" className="nav-pix" />,
  },
  {
    href: '/stad',
    label: 'Stad',
    badge: 2,
    icon: <img src="/assets/icons-rpg/stad.png" alt="" className="nav-pix" />,
  },
  {
    href: '/aanvallen',
    label: 'Battle',
    center: true,
    icon: <img src="/assets/icons-rpg/battle.png" alt="" className="nav-pix" />,
  },
  {
    href: '/league',
    label: 'League',
    icon: <img src="/assets/icons-rpg/league.png" alt="" className="nav-pix" />,
  },
  {
    href: '/settings',
    label: 'Meer',
    badge: 1,
    icon: <img src="/assets/icons-rpg/meer.png" alt="" className="nav-pix" />,
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
            <motion.div
              key={item.href}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              style={{ display: 'flex', flex: 1, minWidth: 0 }}
            >
              <Link
                href={item.href}
                className={`arch-tab ${active ? 'active' : ''} ${item.center ? 'center' : ''}`}
                onClick={() => vibrate(15)}
              >
                <div className="arch-tab-icon">
                  {item.icon}
                  {item.badge ? <span className="arch-tab-badge">{item.badge}</span> : null}
                </div>
                <span>{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
