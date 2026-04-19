'use client';

import { useEffect, useState } from 'react';
import BHModal from '../BHModal';
import { useCoins } from '@/lib/useCoins';

interface Props {
  open: boolean;
  onClose: () => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

interface Msg {
  id: string;
  icon: string;
  title: string;
  body: string;
  reward?: number;
  claimed?: boolean;
}

const INBOX_KEY = 'bliep:inbox:v1';

function loadMsgs(): Msg[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    if (raw) return JSON.parse(raw) as Msg[];
  } catch { /* ignore */ }
  // Seed once with welcome messages
  const seeded: Msg[] = [
    { id: 'welcome', icon: '🛡️', title: 'Welkom, ridder', body: 'Je eiland wacht op bevelen. Voltooi dagelijkse opdrachten om je rijk te laten groeien.', reward: 100 },
    { id: 'update-streak', icon: '🔥', title: 'Streak systeem', body: 'Volhouden telt: bouw streaks op voor extra beloningen en trofeeën.' },
    { id: 'chests', icon: '🎁', title: 'Schatkisten open zich', body: 'Kijk vandaag in je schatkamer — een houten kist is klaar.' },
  ];
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
  return seeded;
}

function saveMsgs(msgs: Msg[]) {
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(msgs)); } catch { /* ignore */ }
}

export default function InboxModal({ open, onClose }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const { award } = useCoins();

  useEffect(() => { if (open) setMsgs(loadMsgs()); }, [open]);

  function claim(id: string) {
    const m = msgs.find((x) => x.id === id);
    if (!m || !m.reward || m.claimed) return;
    award(m.reward);
    const next = msgs.map((x) => x.id === id ? { ...x, claimed: true } : x);
    setMsgs(next);
    saveMsgs(next);
  }

  const unread = msgs.filter((m) => m.reward && !m.claimed).length;

  return (
    <BHModal open={open} onClose={onClose} title="Ravenpost" subtitle={unread ? `${unread} nieuwe beloning${unread === 1 ? '' : 'en'}` : 'Alles gelezen'}>
      {msgs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 48 }}>🕊️</div>
          <div style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 13, color: '#5a3a22' }}>
            Geen post vandaag, ridder
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {msgs.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex', gap: 10,
                padding: 10, borderRadius: 8,
                background: 'rgba(42,22,8,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.3)',
              }}
            >
              <div style={{ fontSize: 24, flex: 'none' }}>{m.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 13, color: '#2a1608' }}>{m.title}</div>
                <div style={{ fontFamily: philosopher, fontSize: 12, color: '#3a2312', marginTop: 2, lineHeight: 1.35 }}>
                  {m.body}
                </div>
                {m.reward !== undefined && (
                  <button
                    onClick={() => claim(m.id)}
                    disabled={m.claimed}
                    style={{
                      marginTop: 6,
                      padding: '5px 10px', borderRadius: 999, border: 'none',
                      cursor: m.claimed ? 'default' : 'pointer',
                      background: m.claimed
                        ? 'linear-gradient(180deg, #5a3a22, #2a1608)'
                        : 'linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
                      boxShadow: m.claimed ? 'inset 0 0 0 1px #1a0a02' : 'inset 0 0 0 1.5px #4a2a08, inset 0 1px 0 rgba(255,255,220,.55), 0 2px 0 rgba(0,0,0,.35)',
                      color: m.claimed ? '#c9ac74' : '#3a2108',
                      fontFamily: cinzel, fontWeight: 900, fontSize: 11,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {m.claimed ? '✓ Opgehaald' : `Claim ${m.reward} 🪙`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </BHModal>
  );
}
