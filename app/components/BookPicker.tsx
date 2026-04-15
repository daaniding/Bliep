'use client';

import type { ReactNode } from 'react';
import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

const TIER_COLOR: Record<DailyTask['tier'], { ribbon: string; text: string; ring: string }> = {
  easy:   { ribbon: '#3d7a3f', text: '#f5ffe6', ring: 'rgba(94,160,92,0.4)' },
  medium: { ribbon: '#d19225', text: '#fff6dc', ring: 'rgba(240,184,64,0.45)' },
  hard:   { ribbon: '#a82d20', text: '#fff0eb', ring: 'rgba(192,57,43,0.45)' },
};

export default function BookPicker({ tasks, onPick }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center px-3 py-6 overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(61, 10, 0, 0.55), transparent 70%), ' +
          'linear-gradient(180deg, #0a0604 0%, #15100a 50%, #0a0604 100%)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div className="relative flex flex-col items-center mt-2 mb-3" style={{ width: '100%', maxWidth: 360 }}>
        <OpenBookSprite />
        <KnightBeside />
      </div>

      <div
        className="px-4 py-2 rounded-lg border-2 border-[#1a0f05] relative text-center mb-5"
        style={{
          background: 'linear-gradient(180deg, #fff6dc 0%, #fae6b6 60%, #d6b67a 100%)',
          boxShadow: '0 4px 0 #1a0f05, 0 8px 16px rgba(0,0,0,0.4)',
        }}
      >
        <p className="font-display text-[13px] text-[#3a2a18] leading-tight">
          Kies uw opdracht uit het boek, sire.
        </p>
        <div
          className="absolute left-1/2 w-3 h-3"
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

      <div className="flex flex-col gap-4 max-w-[360px] w-full mx-auto stagger pb-6">
        {tasks.map((task, i) => (
          <BookTaskCard key={task.id} task={task} index={i} onPick={() => onPick(task)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Open book sprite — craftpix magic book sheet is 1088×816 in a 4×3 grid
 * (272×272 per cell). The fully-open book sits at the bottom-right frame
 * (col 3, row 2 in 0-based = background-position -816 -544). We render
 * that single frame statically, with a gentle float animation.
 */
function OpenBookSprite() {
  return (
    <div
      className="relative"
      style={{
        width: 272,
        height: 272,
        backgroundImage: 'url(/assets/book/open-book.png)',
        backgroundSize: '1088px 816px',
        backgroundPosition: '-816px -544px',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.55))',
        animation: 'bookFloat 3.6s ease-in-out infinite',
      }}
    >
      <style jsx>{`
        @keyframes bookFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/**
 * Knight IDLE sheet — craftpix Knight 2D is 672×84, 7 frames of 96×84.
 * We animate via steps(7). Positioned next to the book.
 */
function KnightBeside() {
  return (
    <div
      className="absolute"
      style={{
        right: -6,
        bottom: 8,
        width: 96,
        height: 84,
        backgroundImage: 'url(/assets/knight/idle-strip.png)',
        backgroundSize: '672px 84px',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        transform: 'scale(1.4)',
        transformOrigin: 'bottom right',
        animation: 'knightIdleBook 1.05s steps(7) infinite',
        filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.5))',
      }}
    >
      <style jsx>{`
        @keyframes knightIdleBook {
          from { background-position: 0 0; }
          to { background-position: -672px 0; }
        }
      `}</style>
    </div>
  );
}

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

function BookTaskCard({ task, index, onPick }: { task: DailyTask; index: number; onPick: () => void }) {
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
        filter: `drop-shadow(0 6px 14px ${colors.ring})`,
      }}
    >
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
