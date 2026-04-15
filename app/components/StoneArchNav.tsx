'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    href: '/settings',
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

      {/* Walkers walking on the top edge (gold road) of the menu bar */}
      <div className="nav-walk-strip" aria-hidden>
        {([
          { src: 'walkers3/hero-knight',    w: 100, h: 55,  frames: 10, size: 160, delay:  '0s'  },
          { src: 'walkers3/knight-horse',   w: 48,  h: 48,  frames: 8,  size: 140, delay: '-6s'  },
          { src: 'walkers2/warrior-blue',   w: 192, h: 192, frames: 6,  size: 140, delay: '-12s' },
          { src: 'walkers3/heavy-bandit',   w: 48,  h: 48,  frames: 8,  size: 124, delay: '-18s' },
          { src: 'walkers2/warrior-purple', w: 192, h: 192, frames: 6,  size: 140, delay: '-24s' },
        ] as const).map((v, i) => {
          const scale = v.size / v.h;
          const displayW = Math.round(v.w * scale);
          const stripW = displayW * v.frames;
          return (
            <div
              key={v.src}
              style={{
                position: 'absolute',
                bottom: 40,
                width: displayW,
                height: v.size,
                overflow: 'hidden',
                animation: 'nav-walker-move 30s linear infinite',
                animationDelay: v.delay,
                zIndex: 3 - (i % 2),
              }}
            >
              <img
                src={`/assets/${v.src}.png`}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: stripW,
                  height: v.size,
                  maxWidth: 'none',
                  minWidth: stripW,
                  imageRendering: 'pixelated',
                  animation: `nav-walker-strip-${v.frames} 0.7s steps(${v.frames}) infinite`,
                  filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.65))',
                  ['--stripW' as string]: `-${stripW}px`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="arch-row">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`arch-tab ${active ? 'active' : ''} ${item.center ? 'center' : ''}`}
            >
              <div className="arch-tab-icon">{item.icon}</div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
