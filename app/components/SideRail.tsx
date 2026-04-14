'use client';

import { useEffect, useState, ReactNode } from 'react';
import { isReady as chestReady, loadFreeChest } from '@/lib/freeChest';
import { unreadCount, MAILBOX_CHANGED_EVENT } from '@/lib/mailbox';
import { sfxTap } from '@/lib/sound';

interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  highlight?: boolean;
  onTap?: () => void;
}

interface Props {
  onMailClick?: () => void;
  onChestClick?: () => void;
}

export default function SideRail({ onMailClick, onChestClick }: Props = {}) {
  const [chestIsReady, setChestIsReady] = useState(() => chestReady(loadFreeChest()));
  const [unread, setUnread] = useState(() => (typeof window !== 'undefined' ? unreadCount() : 0));
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setChestIsReady(chestReady(loadFreeChest()));
      setUnread(unreadCount());
    }, 1000);
    const refresh = () => setUnread(unreadCount());
    window.addEventListener(MAILBOX_CHANGED_EVENT, refresh);
    return () => { clearInterval(id); window.removeEventListener(MAILBOX_CHANGED_EVENT, refresh); };
  }, []);

  function handleTap(item: RailItem) {
    sfxTap();
    if (item.onTap) { item.onTap(); return; }
    setFlash(item.label);
    window.setTimeout(() => setFlash(null), 1800);
  }

  const items: RailItem[] = [
    {
      id: 'mail',
      label: 'Post',
      badge: unread,
      onTap: onMailClick,
      icon: (
        <svg viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="18" rx="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="2.2" />
          <path d="M4 10 L16 19 L28 10" stroke="#0d0a06" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M14 15 L18 19 L22 16 L26 22" stroke="#c0392b" strokeWidth="1.5" opacity="0.7" />
        </svg>
      ),
    },
    {
      id: 'shop',
      label: 'Kist',
      badge: chestIsReady ? 1 : 0,
      highlight: chestIsReady,
      onTap: onChestClick,
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
          onClick={() => handleTap(item)}
          className="relative active:scale-90 transition-transform"
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            // Three-layer 3D: gold outer ring, dark middle, subtle inner glow
            background: item.highlight
              ? 'radial-gradient(circle at 30% 25%, rgba(255, 240, 180, 0.4), transparent 55%), ' +
                'linear-gradient(180deg, #6e4c10 0%, #2a1505 50%, #0d0a06 100%)'
              : 'radial-gradient(circle at 30% 25%, rgba(255, 240, 200, 0.2), transparent 55%), ' +
                'linear-gradient(180deg, #4a3020 0%, #1a1008 55%, #0d0a06 100%)',
            border: '3px solid #0d0a06',
            boxShadow: item.highlight
              ? 'inset 0 0 0 1.5px #f0b840, ' +
                'inset 0 2px 0 rgba(255, 220, 150, 0.55), ' +
                'inset 0 -3px 0 rgba(0, 0, 0, 0.55), ' +
                '0 3px 0 #0d0a06, ' +
                '0 6px 12px rgba(0, 0, 0, 0.65), ' +
                '0 0 18px rgba(240, 184, 64, 0.75)'
              : 'inset 0 0 0 1.5px rgba(240, 184, 64, 0.55), ' +
                'inset 0 2px 0 rgba(255, 220, 150, 0.35), ' +
                'inset 0 -3px 0 rgba(0, 0, 0, 0.6), ' +
                '0 3px 0 #0d0a06, ' +
                '0 6px 12px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 30, height: 30 }}>{item.icon}</div>

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
