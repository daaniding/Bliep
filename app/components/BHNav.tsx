'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { vibrate } from '@/lib/juice';

const MLink = motion.create(Link);

interface TabDef {
  href: string;
  label: string;
  svg: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    href: '/',
    label: 'HOME',
    svg: (
      <>
        <path d="M4 13 L13 4 L22 13 L22 22 L16 22 L16 16 L10 16 L10 22 L4 22 Z" fill="currentColor" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11 4 L13 2 L15 4" fill="currentColor" stroke="#1A0A02" strokeWidth="1.3" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: '/stad',
    label: 'STAD',
    svg: (
      <>
        <path d="M6 4 L20 4 Q22 4 22 6 L22 22 Q22 24 20 24 L6 24 Q4 24 4 22 L4 6 Q4 4 6 4 Z" fill="currentColor" stroke="#1A0A02" strokeWidth="1.5" />
        <path d="M8 12 L18 12 M8 15 L18 15 M8 18 L14 18" stroke="#1A0A02" strokeWidth="1.2" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/aanvallen',
    label: 'BATTLE',
    svg: (
      <>
        <path d="M5 12 Q3 10 4 7 Q6 5 9 6 L13 9 L18 7 Q22 7 22 12 L22 17 Q22 20 19 21 L16 22 L11 22 L7 20 Q4 18 5 15 Z" fill="currentColor" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="12" r="1.3" fill="#1A0A02" />
      </>
    ),
  },
  {
    href: '/league',
    label: 'LEAGUE',
    svg: (
      <>
        <path d="M13 3 L22 5 L22 13 Q22 20 13 23 Q4 20 4 13 L4 5 Z" fill="currentColor" stroke="#1A0A02" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 13 L13 18 L18 13" fill="none" stroke="#1A0A02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: '/settings',
    label: 'MEER',
    svg: (
      <>
        <circle cx="13" cy="13" r="3.5" fill="currentColor" stroke="#1A0A02" strokeWidth="1.5" />
        <path d="M13 3 L13 6 M13 20 L13 23 M3 13 L6 13 M20 13 L23 13 M5.5 5.5 L7.6 7.6 M18.4 18.4 L20.5 20.5 M5.5 20.5 L7.6 18.4 M18.4 7.6 L20.5 5.5" stroke="#1A0A02" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
];

export default function BHNav() {
  const pathname = usePathname() || '/';
  return (
    <nav className="bh-nav" aria-label="Hoofd navigatie">
      <div className="bh-nav-inner">
        {TABS.map(t => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <MLink
              key={t.href}
              href={t.href}
              className={`bh-nav-tab${active ? ' bh-nav-tab-active' : ''}`}
              aria-label={t.label}
              onClick={() => vibrate(10)}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              <svg viewBox="0 0 26 26" fill="none" aria-hidden>
                {t.svg}
              </svg>
              <span>{t.label}</span>
            </MLink>
          );
        })}
      </div>
    </nav>
  );
}
