'use client';

import { useState, type ReactNode } from 'react';
import UISprite from './UISprite';
import { TIER_CONFIG, type DailyTask } from '@/lib/dailyTasks';
import { trophiesForTier } from '@/lib/trophies';

/** Hand-styled wood plank card. Used as task card background instead of
    Tiny Swords wood_table sprite (that sprite is a tile sheet, not a frame). */
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
          '0 5px 0 #1a0f05, ' +
          '0 8px 18px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

interface Props {
  task: DailyTask | null;
  completed: boolean;
  outcome: 'won' | 'gave-up' | 'failed-locked' | null;
  onStart: () => void;
}

const TIER_COLOR: Record<DailyTask['tier'], { ribbon: string; text: string; ring: string }> = {
  easy:   { ribbon: '#3d7a3f', text: '#f5ffe6', ring: 'rgba(94,160,92,0.55)' },
  medium: { ribbon: '#d19225', text: '#fff6dc', ring: 'rgba(240,184,64,0.6)' },
  hard:   { ribbon: '#a82d20', text: '#fff0eb', ring: 'rgba(192,57,43,0.6)' },
};

/**
 * Wood-table styled task card. Replaces the SwordCTA. Shows the active daily
 * task with tier ribbon, body text, rewards row, and a big red START button.
 * Tap → onStart() opens the timer modal.
 */
export default function TaskCard({ task, completed, outcome, onStart }: Props) {
  const [pressed, setPressed] = useState(false);

  if (!task) return null;

  const tier = task.tier;
  const cfg = TIER_CONFIG[tier];
  const colors = TIER_COLOR[tier];

  if (completed) {
    return (
      <div className="w-full max-w-[340px] mx-auto">
        <WoodCard>
          <div className="px-4 py-5 text-center">
            <p className="font-display text-base text-[#fff6dc] text-stroke-dark">
              {outcome === 'won' && '🏆 De dag is gewonnen'}
              {outcome === 'gave-up' && '💤 Dag is voorbij'}
              {outcome === 'failed-locked' && '⚔️ Dag is voorbij'}
            </p>
            <p className="text-[#d6b67a] text-[11px] font-display uppercase tracking-widest mt-1">
              Morgen weer
            </p>
          </div>
        </WoodCard>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[340px] mx-auto relative" style={{ filter: `drop-shadow(0 8px 18px ${colors.ring})` }}>
      {/* Tier ribbon perched on top of the wood card */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 px-5 py-1.5 rounded-md font-display text-[12px] tracking-wider"
        style={{
          top: -12,
          background: `linear-gradient(180deg, ${colors.ribbon} 0%, ${colors.ribbon}cc 100%)`,
          color: colors.text,
          border: '2px solid #1a0f05',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 3px 0 #1a0f05',
          textShadow: '0 1px 0 #0d0a06',
        }}
      >
        {cfg.emoji} {cfg.label.toUpperCase()} · {task.durationMin} MIN
      </div>

      <WoodCard>
        <div className="pt-5 pb-4 px-4 flex flex-col items-center gap-3">
          {/* Task body text on a parchment strip */}
          <div
            className="w-full px-3 py-2 rounded-md text-center"
            style={{
              background: 'linear-gradient(180deg, #fff6dc 0%, #fae6b6 60%, #d6b67a 100%)',
              border: '2px solid #1a0f05',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <p
              className="text-[14px] leading-snug font-semibold text-[#3a2a18]"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {task.text}
            </p>
          </div>

          {/* Reward row */}
          <div className="flex items-center gap-2 text-[11px] font-display">
            <span className="bg-[#fff6dc] border-2 border-[#1a0f05] rounded-md px-2 py-0.5 flex items-center gap-1 text-[#6b4520]">
              <span>🪙</span>
              <span className="tabular-nums">{task.coins}</span>
            </span>
            <span className="bg-[#fff6dc] border-2 border-[#1a0f05] rounded-md px-2 py-0.5 flex items-center gap-1 text-[#6b4520]">
              <span>🏆</span>
              <span className="tabular-nums">+{trophiesForTier(tier)}</span>
            </span>
            <span className="bg-[#fff6dc] border-2 border-[#1a0f05] rounded-md px-2 py-0.5 flex items-center gap-1 text-[#6b4520]">
              <span>⚡</span>
              <span className="tabular-nums">+1</span>
            </span>
          </div>

          {/* Big red START button (CSS styled, Tiny Swords vibes) */}
          <button
            onClick={onStart}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            className="relative w-[180px] h-[54px] rounded-xl flex items-center justify-center font-display text-[18px] tracking-wider text-white active:translate-y-[3px] transition-transform"
            style={{
              background: pressed
                ? 'linear-gradient(180deg, #a82d20 0%, #7a1a10 100%)'
                : 'linear-gradient(180deg, #ef5e4a 0%, #c0392b 50%, #7a1a10 100%)',
              border: '3px solid #1a0f05',
              boxShadow: pressed
                ? 'inset 0 2px 4px rgba(0,0,0,0.4), 0 1px 0 #1a0f05, 0 0 12px rgba(192,57,43,0.5)'
                : 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.3), 0 4px 0 #1a0f05, 0 6px 14px rgba(192,57,43,0.45)',
              textShadow: '0 2px 0 #1a0f05, 0 0 12px rgba(255,200,150,0.4)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            START ⚔
          </button>
        </div>
      </WoodCard>
    </div>
  );
}
