'use client';

import { useEffect, useState } from 'react';
import { loadMailbox, markAllRead, MAILBOX_CHANGED_EVENT, type MailItem } from '@/lib/mailbox';
import { sfxTap } from '@/lib/sound';

interface Props {
  onClose: () => void;
}

function fmtTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Zojuist';
  if (m < 60) return `${m}m geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}u geleden`;
  const d = Math.floor(h / 24);
  return `${d}d geleden`;
}

export default function MailModal({ onClose }: Props) {
  const [items, setItems] = useState<MailItem[]>([]);

  useEffect(() => {
    setItems(loadMailbox().items);
    const refresh = () => setItems(loadMailbox().items);
    window.addEventListener(MAILBOX_CHANGED_EVENT, refresh);
    // Mark all as read on open, after a short delay so the badge
    // pop is visible for a moment
    const timeout = window.setTimeout(() => markAllRead(), 400);
    return () => {
      window.removeEventListener(MAILBOX_CHANGED_EVENT, refresh);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center animate-fade-up"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(40, 20, 5, 0.75), transparent 70%), ' +
          'linear-gradient(180deg, rgba(10, 6, 4, 0.8), rgba(0, 0, 0, 0.92))',
        backdropFilter: 'blur(5px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-wood-img relative w-full"
        style={{
          maxWidth: 460,
          borderRadius: '18px 18px 0 0',
          padding: '18px 14px calc(18px + env(safe-area-inset-bottom)) 14px',
          maxHeight: '82dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Corner rivets */}
        <span className="rivet" style={{ top: 6, left: 10 }} />
        <span className="rivet" style={{ top: 6, right: 10 }} />

        {/* Header */}
        <div className="flex items-center justify-between px-1 mb-3">
          <div>
            <p className="font-display" style={{ fontSize: 10, color: '#fdd069', letterSpacing: '0.18em', textTransform: 'uppercase', textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>
              Koninklijke post
            </p>
            <h2
              className="font-display"
              style={{
                fontSize: 22,
                color: '#fff6dc',
                WebkitTextStroke: '2px #0d0a06',
                paintOrder: 'stroke fill',
                textShadow: '0 2px 0 #0d0a06',
              }}
            >
              Postbus
            </h2>
          </div>
          <button
            onClick={() => { sfxTap(); onClose(); }}
            className="active:scale-90 transition-transform"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #4a3020 0%, #1a0f05 100%)',
              border: '2px solid #0d0a06',
              color: '#fdd069',
              fontSize: 18,
              fontFamily: 'Lilita One, sans-serif',
              boxShadow: 'inset 0 1px 0 rgba(240, 184, 64, 0.5), 0 2px 0 #0d0a06, 0 4px 8px rgba(0, 0, 0, 0.6)',
            }}
          >
            ×
          </button>
        </div>

        {/* List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingRight: 4,
          }}
        >
          {items.length === 0 && (
            <div className="panel-parchment text-center" style={{ padding: 28 }}>
              <p className="font-display" style={{ fontSize: 14, color: '#5c3a1e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Je postbus is leeg
              </p>
              <p className="font-body" style={{ fontSize: 12, color: '#7a4f2a', marginTop: 8 }}>
                Claim een gratis kist om je eerste bericht te ontvangen.
              </p>
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className="panel-parchment relative" style={{ padding: '12px 14px 12px 16px' }}>
              {/* Unread indicator */}
              {!item.read && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 30% 30%, #ff9060 0%, #c0392b 80%)',
                    border: '1.5px solid #0d0a06',
                    boxShadow: '0 0 8px rgba(255, 100, 60, 0.8)',
                  }}
                />
              )}
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background:
                      item.type === 'chest'
                        ? 'radial-gradient(circle at 32% 28%, #fff6dc 0%, #fdd069 22%, #c8891e 70%, #6e4c10 100%)'
                        : 'radial-gradient(circle at 32% 28%, #d6c8f0 0%, #8a4bbf 60%, #2a0f3d 100%)',
                    border: '2px solid #0d0a06',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 4px rgba(0,0,0,0.4)',
                    fontSize: 20,
                  }}
                >
                  {item.type === 'chest' ? '📦' : '📜'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="font-display"
                    style={{
                      fontSize: 12,
                      color: '#2a1505',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      lineHeight: 1.15,
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="font-body"
                    style={{
                      fontSize: 12,
                      color: '#5c3a1e',
                      fontWeight: 600,
                      marginTop: 3,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.body}
                  </p>
                  <p
                    className="font-display"
                    style={{
                      fontSize: 9,
                      color: '#7a4f2a',
                      marginTop: 4,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {fmtTime(item.receivedAt)}
                  </p>
                </div>
                {item.coins != null && (
                  <div
                    className="font-display flex-shrink-0"
                    style={{
                      fontSize: 15,
                      color: '#2a1505',
                      background:
                        'linear-gradient(180deg, #fff6dc 0%, #fdd069 20%, #c8891e 100%)',
                      border: '2px solid #0d0a06',
                      borderRadius: 8,
                      padding: '3px 10px',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 0 #6e4c10',
                      textShadow: '0 1px 0 rgba(255,255,255,0.4)',
                    }}
                  >
                    +{item.coins}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
