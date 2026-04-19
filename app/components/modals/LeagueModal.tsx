'use client';

import Link from 'next/link';
import BHModal from '../BHModal';

interface Props {
  open: boolean;
  onClose: () => void;
  trophies: number;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

interface Tier {
  name: string;
  min: number;
  color: string;
  icon: string;
}

const TIERS: Tier[] = [
  { name: 'Hout',     min: 0,    color: '#7a4320', icon: '🪵' },
  { name: 'Brons',    min: 50,   color: '#a86a10', icon: '🥉' },
  { name: 'Zilver',   min: 150,  color: '#9aaab8', icon: '🥈' },
  { name: 'Goud',     min: 350,  color: '#F5C842', icon: '🥇' },
  { name: 'Platina',  min: 700,  color: '#6fd4f0', icon: '💠' },
  { name: 'Diamant',  min: 1200, color: '#b080e0', icon: '💎' },
  { name: 'Koninklijk', min: 2000, color: '#d43b2a', icon: '👑' },
];

function currentTier(t: number): { cur: Tier; next: Tier | null } {
  let cur = TIERS[0];
  let next: Tier | null = TIERS[1] ?? null;
  for (let i = 0; i < TIERS.length; i++) {
    if (t >= TIERS[i].min) {
      cur = TIERS[i];
      next = TIERS[i + 1] ?? null;
    }
  }
  return { cur, next };
}

export default function LeagueModal({ open, onClose, trophies }: Props) {
  const { cur, next } = currentTier(trophies);
  const pct = next
    ? Math.min(100, Math.round(((trophies - cur.min) / (next.min - cur.min)) * 100))
    : 100;

  return (
    <BHModal open={open} onClose={onClose} title="League" subtitle="Klim omhoog met trofeeën">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* current tier */}
        <div style={{
          textAlign: 'center',
          padding: '14px 10px',
          borderRadius: 12,
          background: `radial-gradient(100% 80% at 50% 0%, ${cur.color}44 0%, rgba(42,22,8,0.06) 70%)`,
          boxShadow: `inset 0 0 0 1.5px ${cur.color}88`,
        }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{cur.icon}</div>
          <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 22, color: '#2a1608', marginTop: 4, letterSpacing: '0.04em' }}>
            {cur.name.toUpperCase()} LEAGUE
          </div>
          <div style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 12, color: '#5a3a22' }}>
            🏆 {trophies} trofeeën
          </div>
        </div>

        {/* progress to next */}
        {next && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: cinzel, fontSize: 11, color: '#3a2312', marginBottom: 4 }}>
              <span>{cur.min}</span>
              <span>Volgende: {next.name} ({next.min})</span>
            </div>
            <div style={{ position: 'relative', height: 14, borderRadius: 999, background: 'rgba(42,22,8,0.2)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', inset: '1px 1px 1px 1px', width: `calc(${pct}% - 2px)`,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${next.color} 0%, ${cur.color} 100%)`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
                transition: 'width .4s ease',
              }} />
            </div>
            <div style={{ marginTop: 4, fontFamily: philosopher, fontSize: 11, color: '#5a3a22', textAlign: 'center' }}>
              Nog <b>{next.min - trophies}</b> trofeeën voor promotie
            </div>
          </div>
        )}

        {/* all tiers list */}
        <div>
          <div style={{ fontFamily: cinzel, fontSize: 10, color: '#5a3a22', letterSpacing: '0.22em', marginBottom: 6 }}>
            ALLE LEAGUES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {TIERS.map((t) => {
              const reached = trophies >= t.min;
              const isCurrent = t.name === cur.name;
              return (
                <div key={t.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', borderRadius: 6,
                  background: isCurrent
                    ? `${t.color}33`
                    : reached ? 'rgba(42,22,8,0.1)' : 'rgba(42,22,8,0.05)',
                  boxShadow: isCurrent
                    ? `inset 0 0 0 1.5px ${t.color}aa`
                    : 'inset 0 0 0 1px rgba(42,22,8,0.25)',
                  opacity: reached ? 1 : 0.55,
                }}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <span style={{ flex: 1, fontFamily: cinzel, fontWeight: 800, fontSize: 13, color: '#2a1608' }}>
                    {t.name}
                  </span>
                  <span style={{ fontFamily: philosopher, fontSize: 11, color: '#5a3a22' }}>
                    {t.min}+ 🏆
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Link
          href="/league"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 14px', borderRadius: 10,
            background: 'linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
            boxShadow: 'inset 0 0 0 1.5px #4a2a08, inset 0 0 0 2.5px rgba(255,240,150,.5), inset 0 2px 0 rgba(255,255,220,.55), 0 3px 0 rgba(0,0,0,.5)',
            color: '#3a2108',
            fontFamily: cinzel, fontWeight: 900, fontSize: 13, letterSpacing: '0.08em',
            textDecoration: 'none',
          }}
        >
          RANGLIJST BEKIJKEN
        </Link>
      </div>
    </BHModal>
  );
}
