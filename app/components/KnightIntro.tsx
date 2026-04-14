'use client';

import type { ReactNode } from 'react';
import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

function WoodCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-xl ${className}`}
      style={{
        background:
          'repeating-linear-gradient(180deg, #6b4520 0px, #5a3818 6px, #6b4520 10px), ' +
          'linear-gradient(180deg, #8b6228 0%, #6b4920 100%)',
        backgroundBlendMode: 'multiply',
        border: '3px solid #1a0f05',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.18), ' +
          'inset 0 -3px 0 rgba(0,0,0,0.4), ' +
          '0 4px 0 #1a0f05, ' +
          '0 6px 14px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

const TIER_COLOR: Record<DailyTask['tier'], { ribbon: string; text: string; ring: string }> = {
  easy:   { ribbon: '#3d7a3f', text: '#f5ffe6', ring: 'rgba(94,160,92,0.4)' },
  medium: { ribbon: '#d19225', text: '#fff6dc', ring: 'rgba(240,184,64,0.45)' },
  hard:   { ribbon: '#a82d20', text: '#fff0eb', ring: 'rgba(192,57,43,0.45)' },
};

/**
 * Knight intro screen — replaces the DailyPickerModal. A blue Tiny Swords
 * warrior sprite stands at the top with a banner-ribbon dialogue ("Welke
 * opdracht kies je vandaag, sire?"), and three wood-table cards below offer
 * the day's task choices. Inline component, not a modal.
 *
 * The warrior_blue_idle sheet is 1536x192 = 8 frames of 192x192. Animated
 * via CSS step() background-position keyframes.
 */
export default function KnightIntro({ tasks, onPick }: Props) {
  return (
    <div className="hero-fill animate-fade-up relative flex flex-col items-stretch px-3 pt-2 pb-2">
      {/* Knight + dialogue */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <KnightSprite />

        <div
          className="px-4 py-2 rounded-lg border-2 border-[#1a0f05] relative max-w-[300px] text-center"
          style={{
            background: 'linear-gradient(180deg, #fff6dc 0%, #fae6b6 60%, #d6b67a 100%)',
            boxShadow: '0 4px 0 #1a0f05, 0 8px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p className="font-display text-[13px] text-[#3a2a18] leading-tight">
            Welke opdracht kies je vandaag, sire?
          </p>
          {/* Speech tail pointing up at knight */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3"
            style={{
              top: -8,
              background: '#fff6dc',
              border: '2px solid #1a0f05',
              borderRight: 'none',
              borderBottom: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      </div>

      {/* 3 task choice cards */}
      <div className="flex flex-col gap-3 max-w-[360px] w-full mx-auto stagger">
        {tasks.map((task, i) => (
          <KnightTaskCard key={task.id} task={task} index={i} onPick={() => onPick(task)} />
        ))}
      </div>
    </div>
  );
}

function KnightSprite() {
  // 8 frames of 192x192 in a horizontal sheet (1536x192). Display at 96x96
  // (50% scale) so the knight is dominant but doesn't eat the whole screen.
  return (
    <div
      className="relative"
      style={{
        width: 96,
        height: 96,
        backgroundImage: 'url(/assets/topdown/units/warrior_blue_idle.png)',
        backgroundSize: '768px 96px', // 1536/2 x 192/2 = 768 x 96
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        animation: 'knightIdle 1.2s steps(8) infinite',
        filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.4))',
      }}
    >
      <style jsx>{`
        @keyframes knightIdle {
          from { background-position: 0 0; }
          to { background-position: -768px 0; }
        }
      `}</style>
    </div>
  );
}

function KnightTaskCard({ task, index, onPick }: { task: DailyTask; index: number; onPick: () => void }) {
  const cfg = TIER_CONFIG[task.tier];
  const colors = TIER_COLOR[task.tier];
  return (
    <button
      onClick={onPick}
      className="relative w-full text-left active:scale-[0.98] transition-transform animate-fade-up"
      style={{
        animationDelay: `${index * 100}ms`,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        filter: `drop-shadow(0 4px 10px ${colors.ring})`,
      }}
    >
      {/* Tier ribbon */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 px-4 py-1 rounded-md font-display text-[11px] tracking-wider"
        style={{
          top: -10,
          background: colors.ribbon,
          color: colors.text,
          border: '2px solid #1a0f05',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 0 #1a0f05',
          textShadow: '0 1px 0 #0d0a06',
        }}
      >
        {cfg.emoji} {cfg.label.toUpperCase()}
      </div>

      <WoodCard>
        <div className="pt-4 pb-3 px-3 flex flex-col items-center gap-2">
          <div
            className="w-full px-3 py-2 rounded-md text-center"
            style={{
              background: 'linear-gradient(180deg, #fff6dc 0%, #fae6b6 60%, #d6b67a 100%)',
              border: '2px solid #1a0f05',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <p
              className="text-[13px] leading-tight font-semibold text-[#3a2a18]"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {task.text}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-display">
            <span className="bg-[#fff6dc] border border-[#1a0f05] rounded px-1.5 py-0.5 tabular-nums text-[#6b4520]">
              {task.durationMin} MIN
            </span>
            <span className="bg-[#fff6dc] border border-[#1a0f05] rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[#6b4520]">
              <span>🪙</span><span className="tabular-nums">{task.coins}</span>
            </span>
            <span className="bg-[#fff6dc] border border-[#1a0f05] rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[#6b4520]">
              <span>🏆</span><span className="tabular-nums">+{trophiesForTier(task.tier)}</span>
            </span>
          </div>
        </div>
      </WoodCard>
    </button>
  );
}
