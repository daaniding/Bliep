'use client';

import { useEffect, useState, ReactNode } from 'react';
import { isReady as chestReady, loadFreeChest } from '@/lib/freeChest';
import { sfxTap } from '@/lib/sound';

interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;      // red dot with optional count
  highlight?: boolean; // gold glow
}

export default function SideRail() {
  const [chestIsReady, setChestIsReady] = useState(() => chestReady(loadFreeChest()));
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setChestIsReady(chestReady(loadFreeChest())), 1000);
    return () => clearInterval(id);
  }, []);

  function handleTap(label: string) {
    sfxTap();
    setFlash(label);
    window.setTimeout(() => setFlash(null), 1800);
  }

  const items: RailItem[] = [
    {
      id: 'mail',
      label: 'Post',
      badge: 2,
      icon: (
        <svg viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="18" rx="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="2.2" />
          <path d="M4 10 L16 19 L28 10" stroke="#0d0a06" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M14 15 L18 19 L22 16 L26 22" stroke="#c0392b" strokeWidth="1.5" opacity="0.7" />
        </svg>
      ),
    },
    {
      id: 'events',
      label: 'Events',
      badge: 1,
      highlight: true,
      icon: (
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M16 3 L19 10 L26 11 L21 16 L22 23 L16 19 L10 23 L11 16 L6 11 L13 10 Z"
            fill="#fdd069"
            stroke="#0d0a06"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 7 L17.5 11 L22 11.5 L19 14 L19.8 18 L16 16 L12.2 18 L13 14 L10 11.5 L14.5 11 Z" fill="#fff6dc" opacity="0.6" />
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Vrienden',
      icon: (
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="12" cy="11" r="5" fill="#c0392b" stroke="#0d0a06" strokeWidth="2" />
          <circle cx="22" cy="13" r="4" fill="#2a4a6a" stroke="#0d0a06" strokeWidth="2" />
          <path d="M4 27 Q4 18 12 18 Q20 18 20 27" stroke="#0d0a06" strokeWidth="2" fill="#c0392b" strokeLinejoin="round" />
          <path d="M16 27 Q16 20 22 20 Q28 20 28 27" stroke="#0d0a06" strokeWidth="2" fill="#2a4a6a" strokeLinejoin="round" />
          <circle cx="26" cy="6" r="2.5" fill="#5ea05c" stroke="#0d0a06" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: 'shop',
      label: 'Winkel',
      badge: chestIsReady ? 1 : 0,
      icon: (
        <svg viewBox="0 0 32 32" fill="none">
          <rect x="5" y="12" width="22" height="16" fill="#7a4f2a" stroke="#0d0a06" strokeWidth="2" />
          <path d="M4 12 L16 4 L28 12 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          <rect x="13" y="17" width="6" height="11" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1.5" />
          <circle cx="17" cy="22" r="0.8" fill="#fdd069" />
          <line x1="9" y1="12" x2="9" y2="28" stroke="#0d0a06" strokeWidth="1" opacity="0.5" />
          <line x1="23" y1="12" x2="23" y2="28" stroke="#0d0a06" strokeWidth="1" opacity="0.5" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="flex flex-col gap-2 items-end"
      style={{ pointerEvents: 'auto' }}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => handleTap(item.label)}
          className="relative active:scale-90 transition-transform"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background:
              'radial-gradient(circle at 30% 30%, rgba(255, 240, 200, 0.25), transparent 55%), ' +
              'linear-gradient(180deg, #3a2410 0%, #0d0a06 100%)',
            border: item.highlight ? '2px solid #f0b840' : '2px solid #7a4f2a',
            boxShadow: item.highlight
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 0 #6e4c10, 0 4px 10px rgba(0,0,0,0.55), 0 0 14px rgba(240, 184, 64, 0.75)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 0 #0d0a06, 0 4px 8px rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 26, height: 26 }}>{item.icon}</div>

          {/* Red notification badge */}
          {item.badge != null && item.badge > 0 && (
            <div
              className="badge-pop absolute"
              style={{
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 9,
                background: 'linear-gradient(180deg, #ff6a50 0%, #c0392b 100%)',
                border: '1.5px solid #0d0a06',
                color: '#fff6dc',
                fontSize: 10,
                fontFamily: 'Lilita One, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(255, 100, 60, 0.85)',
                lineHeight: 1,
                fontWeight: 400,
              }}
            >
              {item.badge}
            </div>
          )}
        </button>
      ))}

      {/* Flash toast — shows which item you tapped (since content isn't built) */}
      {flash && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none"
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            background: 'linear-gradient(180deg, #1a0f05 0%, #0d0a06 100%)',
            border: '2px solid #f0b840',
            color: '#fdd069',
            fontFamily: 'Lilita One, sans-serif',
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: '0 4px 18px rgba(0,0,0,0.7), 0 0 20px rgba(240, 184, 64, 0.5)',
          }}
        >
          {flash} — komt binnenkort
        </div>
      )}
    </div>
  );
}
