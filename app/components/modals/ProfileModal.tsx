'use client';

import { useEffect, useState } from 'react';
import BHModal from '../BHModal';

interface Stats {
  level: number;
  xp: number;
  xpMax: number;
  coins: number;
  trophies: number;
  streakCurrent: number;
  streakLongest: number;
  buildings: number;
  completed: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  stats: Stats;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

const NAME_KEY = 'bliep:name:v1';

export default function ProfileModal({ open, onClose, stats }: Props) {
  const [name, setName] = useState('DAAN');

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(NAME_KEY);
      if (raw) setName(raw);
    } catch { /* ignore */ }
  }, [open]);

  function saveName(next: string) {
    const clean = next.toUpperCase().slice(0, 14);
    setName(clean);
    try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
  }

  const xpPct = Math.round((stats.xp / stats.xpMax) * 100);

  return (
    <BHModal open={open} onClose={onClose} title="Profiel" subtitle="Stats van de ridder">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* name + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="bh-avatar" style={{ flex: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 8 Q7 3 14 3 Q21 3 21 8 L21 16 Q21 20 18 21 L18 25 L10 25 L10 21 Q7 20 7 16 Z" fill="#d0dae4" stroke="#1A0A02" strokeWidth="1.4" />
              <rect x="8.5" y="12" width="11" height="2.5" fill="#1A0A02" />
              <path d="M14 3 Q17 0 19 1 Q17 3 16 5 Z" fill="#d43b2a" stroke="#1A0A02" strokeWidth="1" />
            </svg>
            <div className="bh-lvl">{stats.level}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={name}
              onChange={(e) => saveName(e.target.value)}
              maxLength={14}
              style={{
                width: '100%',
                fontFamily: cinzel,
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: '0.08em',
                color: '#2a1608',
                background: 'rgba(42,22,8,0.08)',
                border: '1px solid rgba(42,22,8,0.35)',
                borderRadius: 6,
                padding: '6px 10px',
                outline: 'none',
              }}
            />
            <div style={{ marginTop: 6, fontFamily: philosopher, fontSize: 11, color: '#5a3a22' }}>
              Lvl {stats.level} · {stats.xp}/{stats.xpMax} XP ({xpPct}%)
            </div>
          </div>
        </div>

        {/* stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatBlock label="Coins" value={stats.coins.toLocaleString('nl-NL')} icon="🪙" />
          <StatBlock label="Trofeeën" value={stats.trophies} icon="🏆" />
          <StatBlock label="Streak" value={stats.streakCurrent} icon="🔥" />
          <StatBlock label="Record" value={stats.streakLongest} icon="⭐" />
          <StatBlock label="Gebouwen" value={stats.buildings} icon="🏰" />
          <StatBlock label="Taken" value={stats.completed} icon="⚔️" />
        </div>
      </div>
    </BHModal>
  );
}

function StatBlock({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div
      style={{
        padding: '8px 6px',
        borderRadius: 8,
        background: 'rgba(42,22,8,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.3)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 15, color: '#2a1608' }}>{value}</div>
      <div style={{ fontFamily: philosopher, fontSize: 10, color: '#5a3a22', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
