'use client';

import { useEffect, useState } from 'react';
import BHModal from '../BHModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

const MILESTONES = [3, 7, 14, 30, 60];

interface StreakData {
  current: number;
  longest: number;
  lastCompletedDate: string;
  history: string[];
}

function loadStreak(): StreakData {
  if (typeof window === 'undefined') return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
  try {
    const raw = localStorage.getItem('bliep:streak');
    if (raw) { const p = JSON.parse(raw); return { ...p, history: p.history || [] }; }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

function last14Days(): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d);
  }
  return out;
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function StreakModal({ open, onClose }: Props) {
  const [data, setData] = useState<StreakData>({ current: 0, longest: 0, lastCompletedDate: '', history: [] });
  useEffect(() => { if (open) setData(loadStreak()); }, [open]);

  const nextMilestone = MILESTONES.find((m) => m > data.current) ?? MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= data.current) ?? 0;
  const progressPct = nextMilestone > prevMilestone
    ? Math.round(((data.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  const days = last14Days();
  const hist = new Set(data.history);

  return (
    <BHModal open={open} onClose={onClose} title="Streak" subtitle="Dagen achter elkaar volbracht" accent="#e05a3a">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Big streak number */}
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: 56 }}>🔥</div>
          <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 56, color: '#8a2a1a', lineHeight: 1, textShadow: '0 2px 0 rgba(255,240,200,.5)' }}>
            {data.current}
          </div>
          <div style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 13, color: '#5a3a22' }}>
            dag{data.current === 1 ? '' : 'en'} op rij
          </div>
          <div style={{ fontFamily: cinzel, fontSize: 11, color: '#5a3a22', letterSpacing: '0.1em', marginTop: 4 }}>
            RECORD: {data.longest}
          </div>
        </div>

        {/* Milestone progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: cinzel, fontSize: 11, color: '#3a2312', letterSpacing: '0.08em', marginBottom: 4 }}>
            <span>{prevMilestone} dagen</span>
            <span>Volgende: {nextMilestone} dagen</span>
          </div>
          <div style={{ position: 'relative', height: 14, borderRadius: 999, background: 'rgba(42,22,8,0.2)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: '1px 1px 1px 1px', width: `calc(${progressPct}% - 2px)`, borderRadius: 999,
              background: 'linear-gradient(180deg, #ff9a5a 0%, #e05a3a 60%, #8a2a1a 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,220,180,.5)',
              transition: 'width .4s ease',
            }} />
          </div>
        </div>

        {/* Last 14 days dots */}
        <div>
          <div style={{ fontFamily: cinzel, fontSize: 10, color: '#5a3a22', letterSpacing: '0.22em', textAlign: 'center', marginBottom: 6 }}>
            AFGELOPEN 14 DAGEN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4 }}>
            {days.map((d) => {
              const done = hist.has(toDateKey(d));
              return (
                <div
                  key={toDateKey(d)}
                  title={toDateKey(d)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '50%',
                    background: done
                      ? 'radial-gradient(circle at 30% 30%, #ff9a5a, #e05a3a 60%, #8a2a1a 100%)'
                      : 'rgba(42,22,8,0.18)',
                    boxShadow: done
                      ? 'inset 0 0 0 1px #1A0A02, inset 0 1px 0 rgba(255,200,180,.55), 0 1px 2px rgba(0,0,0,.3)'
                      : 'inset 0 0 0 1px rgba(42,22,8,0.35)',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Milestones list */}
        <div>
          <div style={{ fontFamily: cinzel, fontSize: 10, color: '#5a3a22', letterSpacing: '0.22em', marginBottom: 6 }}>
            MIJLPALEN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MILESTONES.map((m) => {
              const reached = data.longest >= m;
              return (
                <div key={m} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: reached ? 'rgba(224,90,58,0.18)' : 'rgba(42,22,8,0.08)',
                  boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.3)',
                  fontFamily: cinzel, fontWeight: 700, fontSize: 12, color: reached ? '#5a1608' : '#5a3a22',
                }}>
                  <span>{reached ? '🏅' : '🔒'} {m} dagen</span>
                  <span style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 11, opacity: 0.8 }}>
                    {reached ? 'Behaald' : `Nog ${m - data.current}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BHModal>
  );
}
