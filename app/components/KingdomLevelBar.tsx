'use client';

import { useXp } from '@/lib/useXp';

// Clash-style level bar — level + XP progress.
// XP is the single progression metric; trophies are battle-ranking only.

export default function KingdomLevelBar() {
  const { xp, info } = useXp();
  const { level, base, next, progress } = info;
  const pct = Math.max(0, Math.min(1, progress / (next - base)));

  return (
    <div className="flex items-center gap-2 pointer-events-auto">
      {/* Level badge — round shield with number */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fff6dc 0%, #fdd069 30%, #a3701a 100%)',
          border: '2.5px solid #0d0a06',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 0 #6e4c10, 0 4px 10px rgba(0,0,0,0.6)',
          flexShrink: 0,
        }}
      >
        <span
          className="font-display"
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: '#0d0a06',
            textShadow: '0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          {level}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="flex-1 relative"
        style={{
          height: 16,
          borderRadius: 8,
          background: 'linear-gradient(180deg, #0d0a06 0%, #1a0f05 100%)',
          border: '2px solid #0d0a06',
          boxShadow:
            'inset 0 2px 4px rgba(0,0,0,0.6), ' +
            '0 1px 0 rgba(255,255,255,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background:
              'linear-gradient(180deg, #fff6dc 0%, #fdd069 25%, #d19225 65%, #a3701a 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.25)',
            transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        {/* Text overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center font-display"
          style={{
            fontSize: 10,
            color: '#fff6dc',
            letterSpacing: '0.04em',
            textShadow: '0 1px 0 rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)',
          }}
        >
          {xp - base} / {next - base} XP
        </div>
      </div>
    </div>
  );
}
