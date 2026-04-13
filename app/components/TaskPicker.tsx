'use client';

import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

// Each tier maps to a Kenney button color. Kenney buttons already have
// bevel + border + texture baked in, so no extra styling needed.
const TIER_BTN_CLASS: Record<DailyTask['tier'], string> = {
  easy: 'kenney-btn',
  medium: 'kenney-btn kenney-btn-brown',
  hard: 'kenney-btn kenney-btn-blue',
};

export default function TaskPicker({ tasks, onPick }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="font-display-bold text-lg text-[var(--color-ink-900)] text-center mb-0.5">Kies je opdracht</h2>
      <p className="text-[var(--color-ink-600)] text-[11px] text-center mb-2 font-body">
        1 keuze per dag · hoger tier = meer beloning
      </p>
      {tasks.map((task) => {
        const cfg = TIER_CONFIG[task.tier];
        return (
          <button
            key={task.id}
            onClick={() => onPick(task)}
            className={`${TIER_BTN_CLASS[task.tier]} !w-full !p-0 !border-[10px] !block !text-left`}
            style={{ minHeight: 0 }}
          >
            <div className="flex items-center gap-3 py-1 px-2">
              <div className="flex-shrink-0 text-2xl">{cfg.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-display-bold text-[11px] tracking-wider">{cfg.label}</span>
                  <span className="font-display-bold text-[12px] tabular-nums">
                    {task.coins}🪙 +{trophiesForTier(task.tier)}🏆
                  </span>
                </div>
                <p className="text-[12px] leading-tight font-body text-left truncate" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {task.text}
                </p>
                <p className="text-[10px] mt-0.5 font-display font-semibold opacity-80">⏱ {task.durationMin} min</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
