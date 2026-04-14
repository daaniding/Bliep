'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { loadDailyPick } from '@/lib/dailyTasks';
import { loadFreeChest, isReady as chestReady } from '@/lib/freeChest';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  center?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        {/* Scroll */}
        <rect x="5" y="8" width="22" height="18" rx="2" fill="#fde3a0" stroke="#1a0f05" strokeWidth="2" />
        <line x1="5" y1="14" x2="27" y2="14" stroke="#7a4f2a" strokeWidth="1.5" />
        <line x1="5" y1="19" x2="22" y2="19" stroke="#7a4f2a" strokeWidth="1.5" />
        <circle cx="5" cy="17" r="3" fill="#7a4f2a" stroke="#1a0f05" strokeWidth="2" />
        <circle cx="27" cy="17" r="3" fill="#7a4f2a" stroke="#1a0f05" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/stad',
    label: 'Stad',
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        {/* Castle */}
        <rect x="6" y="14" width="20" height="14" fill="#7a4f2a" stroke="#1a0f05" strokeWidth="2" />
        <rect x="4" y="10" width="5" height="18" fill="#9b6838" stroke="#1a0f05" strokeWidth="2" />
        <rect x="23" y="10" width="5" height="18" fill="#9b6838" stroke="#1a0f05" strokeWidth="2" />
        <polygon points="4,10 6.5,6 9,10" fill="#c0392b" stroke="#1a0f05" strokeWidth="1.5" />
        <polygon points="23,10 25.5,6 28,10" fill="#c0392b" stroke="#1a0f05" strokeWidth="1.5" />
        <rect x="14" y="20" width="4" height="8" fill="#1a0f05" />
      </svg>
    ),
  },
  {
    href: '/battle',
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
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        {/* Trophy */}
        <path d="M10 6 H22 V14 Q22 20 16 20 Q10 20 10 14 Z" fill="#f0b840" stroke="#1a0f05" strokeWidth="2" />
        <path d="M10 8 Q4 8 4 12 Q4 16 8 17" stroke="#1a0f05" strokeWidth="2" fill="none" />
        <path d="M22 8 Q28 8 28 12 Q28 16 24 17" stroke="#1a0f05" strokeWidth="2" fill="none" />
        <rect x="13" y="20" width="6" height="4" fill="#7a4f2a" stroke="#1a0f05" strokeWidth="2" />
        <rect x="10" y="24" width="12" height="3" fill="#7a4f2a" stroke="#1a0f05" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/meer',
    label: 'Meer',
    icon: (
      <svg viewBox="0 0 32 32" fill="none">
        {/* Gear */}
        <circle cx="16" cy="16" r="6" fill="#9b6838" stroke="#1a0f05" strokeWidth="2" />
        <circle cx="16" cy="16" r="2.5" fill="#1a0f05" />
        {[...Array(8)].map((_, i) => {
          const a = (i * 45) * Math.PI / 180;
          const x1 = 16 + Math.cos(a) * 8;
          const y1 = 16 + Math.sin(a) * 8;
          const x2 = 16 + Math.cos(a) * 12;
          const y2 = 16 + Math.sin(a) * 12;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a0f05" strokeWidth="3" strokeLinecap="round" />;
        })}
      </svg>
    ),
  },
];

export default function StoneArchNav() {
  const pathname = usePathname();
  const [homeBadge, setHomeBadge] = useState(false);
  const [chestBadge, setChestBadge] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const pick = loadDailyPick();
      setHomeBadge(!pick.completed);
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
          <linearGradient id="woodG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a4a1f" />
            <stop offset="0.45" stopColor="#3a2410" />
            <stop offset="1" stopColor="#0d0a06" />
          </linearGradient>
          <pattern id="woodPlank" width="60" height="22" patternUnits="userSpaceOnUse">
            <rect width="60" height="22" fill="url(#woodG)" />
            {/* horizontal plank seams */}
            <line x1="0" y1="0.5" x2="60" y2="0.5" stroke="#0d0a06" strokeWidth="1.2" />
            <line x1="0" y1="11" x2="60" y2="11" stroke="#0d0a06" strokeWidth="0.8" opacity="0.7" />
            <line x1="0" y1="21.5" x2="60" y2="21.5" stroke="#0d0a06" strokeWidth="1.2" />
            {/* wood grain streaks */}
            <line x1="6" y1="2" x2="56" y2="3" stroke="#5a3214" strokeWidth="0.5" opacity="0.4" />
            <line x1="4" y1="13" x2="58" y2="14" stroke="#5a3214" strokeWidth="0.5" opacity="0.4" />
            <line x1="8" y1="18" x2="52" y2="19" stroke="#5a3214" strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>

        {/* Base wood plank bar */}
        <path
          d="M0 40 Q60 20 120 32 Q180 44 220 22 Q260 0 300 22 Q360 44 440 32 L440 120 L0 120 Z"
          fill="url(#woodPlank)"
          stroke="#0d0a06"
          strokeWidth="3"
        />

        {/* Top gold rim */}
        <path
          d="M0 40 Q60 20 120 32 Q180 44 220 22 Q260 0 300 22 Q360 44 440 32"
          fill="none"
          stroke="#f0b840"
          strokeWidth="2.5"
          opacity="0.85"
        />
        <path
          d="M0 42 Q60 22 120 34 Q180 46 220 24 Q260 2 300 24 Q360 46 440 34"
          fill="none"
          stroke="#fff6dc"
          strokeWidth="0.8"
          opacity="0.5"
        />

        {/* Center wood keystone with gold rim */}
        <polygon
          points="200,24 240,24 244,60 196,60"
          fill="url(#woodG)"
          stroke="#0d0a06"
          strokeWidth="2.5"
        />
        <polygon
          points="200,24 240,24 244,60 196,60"
          fill="none"
          stroke="#f0b840"
          strokeWidth="2"
          opacity="0.9"
        />
        {/* Decorative gold rivets on the keystone */}
        <circle cx="206" cy="32" r="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
        <circle cx="234" cy="32" r="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
        <circle cx="208" cy="52" r="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
        <circle cx="232" cy="52" r="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
      </svg>

      <div className="arch-row">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const showBadge =
            (item.href === '/' && (homeBadge || chestBadge));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`arch-tab ${active ? 'active' : ''} ${item.center ? 'center' : ''}`}
            >
              <div className="arch-tab-icon">
                {item.icon}
                {showBadge && <span className="arch-badge" aria-hidden />}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .arch-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 12px;
          height: 12px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 25%, #ff6a4a 0%, #c0392b 55%, #7a1e0a 100%);
          border: 2px solid #fff6dc;
          box-shadow:
            0 0 10px rgba(230, 40, 20, 0.95),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          animation: archBadgePulse 1.6s ease-in-out infinite;
          z-index: 3;
        }
        @keyframes archBadgePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
      `}</style>
    </nav>
  );
}
