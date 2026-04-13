'use client';

import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

const TIER_STYLES: Record<DailyTask['tier'], { gradient: string; border: string; tagBg: string; tagText: string }> = {
  easy: {
    gradient: 'linear-gradient(180deg, var(--color-forest-300) 0%, var(--color-forest-400) 100%)',
    border: 'var(--color-forest-700)',
    tagBg: 'var(--color-forest-700)',
    tagText: '#FFF',
  },
  medium: {
    gradient: 'linear-gradient(180deg, var(--color-gold-200) 0%, var(--color-gold-300) 100%)',
    border: 'var(--color-gold-500)',
    tagBg: 'var(--color-gold-500)',
    tagText: 'var(--color-ink-900)',
  },
  hard: {
    gradient: 'linear-gradient(180deg, var(--color-blood-300) 0%, var(--color-blood-500) 100%)',
    border: 'var(--color-blood-700)',
    tagBg: 'var(--color-blood-700)',
    tagText: '#FFF',
  },
};

export default function TaskPicker({ tasks, onPick }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="font-display-bold text-xl text-[var(--color-ink-900)] text-center mb-1">Kies je opdracht</h2>
      <p className="text-[var(--color-ink-600)] text-xs text-center mb-3">1 keuze per dag · hoger tier = meer beloning</p>
      {tasks.map((task) => {
        const cfg = TIER_CONFIG[task.tier];
        const s = TIER_STYLES[task.tier];
        return (
          <button
            key={task.id}
            onClick={() => onPick(task)}
            className="block w-full text-left rounded-xl active:scale-[0.98] transition-transform"
            style={{
              background: s.gradient,
              border: `2px solid ${s.border}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.2), 0 3px 0 ${s.border}, 0 5px 12px rgba(0,0,0,0.3)`,
              padding: '14px 16px',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
                style={{ background: s.tagBg, color: s.tagText, textShadow: '0 1px 0 rgba(0,0,0,0.2)' }}
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2 font-display font-bold text-sm" style={{ color: 'var(--color-ink-900)', textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>
                <span>{task.coins} 🪙</span>
                <span className="opacity-60">·</span>
                <span>+{trophiesForTier(task.tier)} 🏆</span>
              </div>
            </div>
            <p className="text-[var(--color-ink-900)] text-[14px] leading-snug font-medium" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}>
              {task.text}
            </p>
            <p className="text-[var(--color-ink-700)] text-[11px] mt-1.5 font-display font-semibold" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}>
              ⏱ {task.durationMin} minuten gefocust
            </p>
          </button>
        );
      })}
    </div>
  );
}
