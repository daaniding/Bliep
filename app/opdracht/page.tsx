'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import GameShell from '../components/GameShell';
import TaskTimer from '../components/TaskTimer';
import {
  getDailyTasks,
  loadDailyPick,
  saveDailyPick,
  TIER_CONFIG,
  type DailyTask,
  type DailyPick,
} from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { sfxClaim, sfxFail, sfxTap } from '@/lib/sound';

// Full-page picker → timer flow. Replaces the old DailyPickerModal
// + Timer modal that used to live on home. Tasks are sorted
// easy → medium → hard.

const TIER_ORDER: Record<DailyTask['tier'], number> = { easy: 0, medium: 1, hard: 2 };

const TIER_META: Record<
  DailyTask['tier'],
  { label: string; bladeFill: string; gripFill: string; glow: string; gemFill: string }
> = {
  easy: { label: 'Makkelijk', bladeFill: '#5ea05c', gripFill: '#1e4a26', glow: 'rgba(94,160,92,0.5)', gemFill: '#5ea05c' },
  medium: { label: 'Medium', bladeFill: '#d19225', gripFill: '#6e4c10', glow: 'rgba(240,184,64,0.55)', gemFill: '#f0b840' },
  hard: { label: 'Lastig', bladeFill: '#c0392b', gripFill: '#3d0a00', glow: 'rgba(192,57,43,0.55)', gemFill: '#c0392b' },
};

function getToday(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
    .toISOString()
    .split('T')[0];
}

function getYesterday(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function loadStreakLS() {
  try {
    const raw = localStorage.getItem('bliep:streak');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, history: parsed.history || [] };
    }
  } catch { /* ignore */ }
  return { current: 0, longest: 0, lastCompletedDate: '', history: [] };
}

function saveStreakLS(streak: { current: number; longest: number; lastCompletedDate: string; history: string[] }) {
  localStorage.setItem('bliep:streak', JSON.stringify(streak));
}

export default function OpdrachtPage() {
  const router = useRouter();
  const [tasks] = useState<DailyTask[]>(() => getDailyTasks().slice().sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]));
  const [pick, setPick] = useState<DailyPick>(() => loadDailyPick());
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const confettiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPick(loadDailyPick());
  }, []);

  const chosenTask = pick.chosenId ? tasks.find(t => t.id === pick.chosenId) ?? null : null;

  const handlePick = (task: DailyTask) => {
    sfxTap();
    const next: DailyPick = { date: pick.date, chosenId: task.id, completed: false, outcome: null };
    saveDailyPick(next);
    setPick(next);
  };

  const completeStreak = useCallback(() => {
    const s = loadStreakLS();
    const today = getToday();
    if (s.lastCompletedDate === today) return;
    const isConsecutive = s.lastCompletedDate === getYesterday();
    const newCurrent = isConsecutive ? s.current + 1 : 1;
    saveStreakLS({
      current: newCurrent,
      longest: Math.max(s.longest, newCurrent),
      lastCompletedDate: today,
      history: [...(s.history || []), today],
    });
  }, []);

  const handleClaim = (coinAmount: number) => {
    sfxClaim();
    award(coinAmount);
    if (chosenTask) {
      awardTrophies(trophiesForTier(chosenTask.tier), `Taak voltooid (${chosenTask.tier})`);
    }
    const next: DailyPick = { ...pick, completed: true, outcome: 'won' };
    saveDailyPick(next);
    setPick(next);
    completeStreak();
    setTimeout(() => router.push('/'), 1200);
  };

  const handleAbort = () => {
    sfxFail();
    const next: DailyPick = { ...pick, completed: true, outcome: 'gave-up' };
    saveDailyPick(next);
    setPick(next);
    router.push('/');
  };

  const handleFailLock = () => {
    sfxFail();
    const next: DailyPick = { ...pick, completed: true, outcome: 'failed-locked' };
    saveDailyPick(next);
    setPick(next);
    router.push('/');
  };

  return (
    <GameShell>
      <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-[9999]" />

      <div
        className="flex flex-col items-stretch w-full mx-auto"
        style={{
          maxWidth: 480,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 84px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
          paddingLeft: 16,
          paddingRight: 16,
          gap: 18,
          minHeight: '100dvh',
        }}
      >
        {/* === Picker view === */}
        {!chosenTask && !pick.completed && (
          <>
            <header className="text-center animate-fade-up">
              <p
                className="font-display"
                style={{
                  fontSize: 11,
                  color: '#fdd069',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Vandaag
              </p>
              <h1
                className="font-display"
                style={{
                  fontSize: 28,
                  color: '#fff6dc',
                  WebkitTextStroke: '2.5px #0d0a06',
                  paintOrder: 'stroke fill',
                  textShadow: '0 3px 0 #0d0a06',
                  lineHeight: 1.1,
                }}
              >
                Kies je opdracht
              </h1>
              <p
                className="font-body"
                style={{
                  fontSize: 12,
                  color: '#f4e6b8',
                  opacity: 0.8,
                  marginTop: 8,
                }}
              >
                Eén keuze per dag. Houd Bliep open tot de timer eindigt.
              </p>
            </header>

            <div className="flex flex-col gap-3 stagger">
              {tasks.map(task => {
                const meta = TIER_META[task.tier];
                const cfg = TIER_CONFIG[task.tier];
                return (
                  <button
                    key={task.id}
                    onClick={() => handlePick(task)}
                    className="block w-full active:scale-[0.98] transition-transform animate-fade-up"
                    style={{
                      padding: 0,
                      background: 'transparent',
                      border: 0,
                      minHeight: 92,
                    }}
                  >
                    <TaskScroll
                      text={task.text}
                      label={meta.label}
                      labelEmoji={cfg.emoji}
                      durationMin={task.durationMin}
                      coins={task.coins}
                      trophies={trophiesForTier(task.tier)}
                      bladeFill={meta.bladeFill}
                      gripFill={meta.gripFill}
                      glow={meta.glow}
                      gemFill={meta.gemFill}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* === Timer view === */}
        {chosenTask && !pick.completed && (
          <div className="animate-fade-up flex flex-col gap-3">
            <div className="frame-gold-img">
              <div className="frame-inner" style={{ padding: '8px 10px' }}>
                <TaskTimer
                  task={chosenTask}
                  onClaim={handleClaim}
                  onAbort={handleAbort}
                  onFailLock={handleFailLock}
                />
              </div>
            </div>
          </div>
        )}

        {/* === Completed view === */}
        {pick.completed && (
          <div className="animate-fade-up flex flex-col items-center gap-4 text-center" style={{ marginTop: 24 }}>
            <h1
              className="font-display"
              style={{
                fontSize: 32,
                color: pick.outcome === 'won' ? '#5ea05c' : '#9a9aa2',
                WebkitTextStroke: '2.5px #0d0a06',
                paintOrder: 'stroke fill',
                textShadow: '0 3px 0 #0d0a06',
                lineHeight: 1.1,
              }}
            >
              {pick.outcome === 'won' ? '🏆 Gewonnen' : '💤 Voorbij'}
            </h1>
            <p className="font-body" style={{ color: '#f4e6b8', fontSize: 14 }}>
              {pick.outcome === 'won'
                ? 'Beloningen geclaimed. Kom morgen terug voor een nieuwe opdracht.'
                : 'De dag is voorbij. Morgen is er weer een kans.'}
            </p>
            <button
              onClick={() => { sfxTap(); router.push('/'); }}
              className="active:scale-95 transition-transform"
              style={{
                marginTop: 12,
                padding: '14px 36px',
                borderRadius: 16,
                background: 'linear-gradient(180deg, #fff6dc 0%, #fdd069 18%, #f0b840 50%, #c8891e 100%)',
                border: '3px solid #0d0a06',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 0 #6e4c10, 0 8px 16px rgba(0,0,0,0.6)',
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: 16,
                  color: '#2a1505',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textShadow: '0 1px 0 rgba(255,255,255,0.5)',
                }}
              >
                Terug naar home
              </span>
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function TaskScroll({
  text, label, labelEmoji, durationMin, coins, trophies, bladeFill, gripFill, glow, gemFill,
}: {
  text: string; label: string; labelEmoji: string; durationMin: number; coins: number; trophies: number;
  bladeFill: string; gripFill: string; glow: string; gemFill: string;
}) {
  return (
    <div className="relative" style={{ filter: `drop-shadow(0 8px 20px ${glow})` }}>
      <svg viewBox="0 0 380 100" xmlns="http://www.w3.org/2000/svg" className="w-full">
        <defs>
          <linearGradient id={`opd-parchG-${bladeFill}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6dc" />
            <stop offset="50%" stopColor="#fae6b6" />
            <stop offset="100%" stopColor="#d6b67a" />
          </linearGradient>
          <linearGradient id={`opd-gripG-${gripFill}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gripFill} />
            <stop offset="100%" stopColor="#0d0a06" />
          </linearGradient>
        </defs>
        <rect x="44" y="14" width="292" height="72" fill={`url(#opd-parchG-${bladeFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        <rect x="44" y="14" width="292" height="8" fill="rgba(0,0,0,0.15)" />
        <rect x="44" y="78" width="292" height="8" fill="rgba(0,0,0,0.2)" />
        <rect x="14" y="8" width="36" height="84" rx="6" fill={`url(#opd-gripG-${gripFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        <line x1="18" y1="14" x2="18" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <line x1="32" y1="14" x2="32" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <circle cx="32" cy="50" r="4" fill={gemFill} stroke="#0d0a06" strokeWidth="1.5" />
        <rect x="330" y="8" width="36" height="84" rx="6" fill={`url(#opd-gripG-${gripFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        <line x1="334" y1="14" x2="334" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <line x1="348" y1="14" x2="348" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <circle cx="348" cy="50" r="4" fill={gemFill} stroke="#0d0a06" strokeWidth="1.5" />
        <g transform="translate(190 14)">
          <path d="M-46 -6 L46 -6 L42 10 L-42 10 Z" fill={bladeFill} stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          <text
            x="0" y="6" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="12"
            fill="#fff6dc" stroke="#0d0a06" strokeWidth="0.8" paintOrder="stroke fill"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            {labelEmoji} {label}
          </text>
        </g>
        <foreignObject x="56" y="34" width="268" height="40">
          <div style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: '#2a1a0a',
            lineHeight: 1.3, textAlign: 'center', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {text}
          </div>
        </foreignObject>
        <text
          x="190" y="80" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="11"
          fill="#6e4c10" style={{ letterSpacing: '0.06em' }}
        >
          {durationMin} MIN · {coins} 🪙 · +{trophies} 🏆
        </text>
      </svg>
    </div>
  );
}
