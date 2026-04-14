'use client';

import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

// Forced full-screen modal shown on first open of the day.
// No dismiss — you MUST pick one of three to proceed.
// Dramatic night-sky background with three task scrolls.

const TIER_META: Record<DailyTask['tier'], { label: string; bladeFill: string; gripFill: string; glow: string; gemFill: string }> = {
  easy:   { label: 'Makkelijk', bladeFill: '#5ea05c', gripFill: '#1e4a26', glow: 'rgba(94,160,92,0.5)',  gemFill: '#5ea05c' },
  medium: { label: 'Medium',    bladeFill: '#d19225', gripFill: '#6e4c10', glow: 'rgba(240,184,64,0.55)', gemFill: '#f0b840' },
  hard:   { label: 'Lastig',    bladeFill: '#c0392b', gripFill: '#3d0a00', glow: 'rgba(192,57,43,0.55)',  gemFill: '#c0392b' },
};

export default function DailyPickerModal({ tasks, onPick }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-24 pt-6"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(10, 6, 4, 0.85), transparent 70%), ' +
          'linear-gradient(180deg, transparent 0%, transparent 30%, rgba(10, 6, 4, 0.4) 100%)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >

      <div className="relative max-w-sm w-full">
        <div className="text-center mb-6 animate-fade-up">
          <p className="text-[var(--color-gold-200)] text-[11px] font-display uppercase tracking-[0.3em] mb-2">
            Eerste van de dag
          </p>
          <h1 className="font-display text-[28px] text-[var(--color-gold-100)] text-stroke-dark leading-tight">
            Kies je opdracht
          </h1>
          <p className="text-[var(--color-parch-200)] text-xs mt-2 font-body">
            Eén keuze per dag. Houd Bliep open tot de timer eindigt.
          </p>
        </div>

        <div className="space-y-3 stagger">
          {tasks.map(task => {
            const meta = TIER_META[task.tier];
            const cfg = TIER_CONFIG[task.tier];
            return (
              <button
                key={task.id}
                onClick={() => onPick(task)}
                className="block w-full active:scale-[0.98] transition-transform animate-fade-up"
                style={{ padding: 0, background: 'transparent', border: 0 }}
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
      </div>
    </div>
  );
}

function TaskScroll({
  text, label, labelEmoji, durationMin, coins, trophies, bladeFill, gripFill, glow, gemFill,
}: {
  text: string; label: string; labelEmoji: string; durationMin: number; coins: number; trophies: number;
  bladeFill: string; gripFill: string; glow: string; gemFill: string;
}) {
  return (
    <div
      className="relative"
      style={{ filter: `drop-shadow(0 8px 20px ${glow})` }}
    >
      <svg viewBox="0 0 380 100" xmlns="http://www.w3.org/2000/svg" className="w-full">
        <defs>
          <linearGradient id={`parchG-${bladeFill}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6dc" />
            <stop offset="50%" stopColor="#fae6b6" />
            <stop offset="100%" stopColor="#d6b67a" />
          </linearGradient>
          <linearGradient id={`gripG-${gripFill}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gripFill} />
            <stop offset="100%" stopColor="#0d0a06" />
          </linearGradient>
        </defs>

        {/* Parchment strip */}
        <rect x="44" y="14" width="292" height="72" fill={`url(#parchG-${bladeFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        {/* Rolled edges shadow */}
        <rect x="44" y="14" width="292" height="8" fill="rgba(0,0,0,0.15)" />
        <rect x="44" y="78" width="292" height="8" fill="rgba(0,0,0,0.2)" />

        {/* Left handle (rolled parchment + wooden cap) */}
        <rect x="14" y="8" width="36" height="84" rx="6" fill={`url(#gripG-${gripFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        <line x1="18" y1="14" x2="18" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <line x1="32" y1="14" x2="32" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <circle cx="32" cy="50" r="4" fill={gemFill} stroke="#0d0a06" strokeWidth="1.5" />

        {/* Right handle */}
        <rect x="330" y="8" width="36" height="84" rx="6" fill={`url(#gripG-${gripFill})`} stroke="#0d0a06" strokeWidth="2.5" />
        <line x1="334" y1="14" x2="334" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <line x1="348" y1="14" x2="348" y2="86" stroke="#1a0f05" strokeWidth="1" />
        <circle cx="348" cy="50" r="4" fill={gemFill} stroke="#0d0a06" strokeWidth="1.5" />

        {/* Tier ribbon above parchment */}
        <g transform="translate(190 14)">
          <path d="M-46 -6 L46 -6 L42 10 L-42 10 Z" fill={bladeFill} stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fontFamily="Lilita One, sans-serif"
            fontSize="12"
            fill="#fff6dc"
            stroke="#0d0a06"
            strokeWidth="0.8"
            paintOrder="stroke fill"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            {labelEmoji} {label}
          </text>
        </g>

        {/* Task text — wrap in 2 lines via foreignObject */}
        <foreignObject x="56" y="34" width="268" height="40">
          <div
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: '#2a1a0a',
              lineHeight: 1.3,
              textAlign: 'center',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {text}
          </div>
        </foreignObject>

        {/* Rewards row along the bottom */}
        <text
          x="190"
          y="80"
          textAnchor="middle"
          fontFamily="Lilita One, sans-serif"
          fontSize="11"
          fill="#6e4c10"
          style={{ letterSpacing: '0.06em' }}
        >
          {durationMin} MIN · {coins} 🪙 · +{trophies} 🏆
        </text>
      </svg>
    </div>
  );
}
