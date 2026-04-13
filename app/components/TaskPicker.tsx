'use client';

import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

const TIER_STYLES: Record<DailyTask['tier'], { ring: string; bg: string; text: string }> = {
  easy:   { ring: 'ring-[#6BA368]/30', bg: 'bg-[#6BA368]/10', text: 'text-[#3a6a3a]' },
  medium: { ring: 'ring-[#E8B84A]/40', bg: 'bg-[#E8B84A]/15', text: 'text-[#8a6320]' },
  hard:   { ring: 'ring-[#C75B3D]/30', bg: 'bg-[#C75B3D]/10', text: 'text-[#7a2e1a]' },
};

export default function TaskPicker({ tasks, onPick }: Props) {
  return (
    <div className="px-5 space-y-3">
      <div className="text-center mb-2">
        <p className="text-accent text-[10px] font-semibold uppercase tracking-wider mb-1">Eerste van de dag</p>
        <h2 className="font-serif text-2xl text-ink italic">Kies je opdracht</h2>
        <p className="text-muted text-xs mt-1">Eén keuze per dag. Hoger tier = langere timer = meer coins.</p>
      </div>
      {tasks.map((task) => {
        const cfg = TIER_CONFIG[task.tier];
        const styles = TIER_STYLES[task.tier];
        return (
          <button
            key={task.id}
            onClick={() => onPick(task)}
            className={`block w-full text-left card-elevated p-5 transition-all active:scale-[0.98] ring-1 ${styles.ring}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`inline-flex items-center gap-1.5 ${styles.bg} ${styles.text} px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider`}>
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2 text-ink font-bold text-sm">
                <span className="flex items-center gap-1"><span>{task.coins}</span><span>🪙</span></span>
                <span className="text-faint">·</span>
                <span className="flex items-center gap-1"><span>+{trophiesForTier(task.tier)}</span><span>🏆</span></span>
              </div>
            </div>
            <p className="text-ink text-[15px] leading-relaxed">{task.text}</p>
            <p className="text-faint text-[11px] mt-2">⏱ {task.durationMin} minuten gefocust werken</p>
          </button>
        );
      })}
    </div>
  );
}
