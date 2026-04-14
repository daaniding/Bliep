'use client';

import { useTrophies } from '@/lib/useTrophies';

// Clash-style level bar. Derives level from total trophies (placeholder
// formula until we have a real XP system). Shows current level number,
// a filled progress bar, and the "N to next level" label.

// Level curve: level N needs N*50 trophies total. Level 1 = 0-49 trophies,
// level 2 = 50-149, level 3 = 150-299, etc. Quadratic-ish.
function levelForTrophies(t: number): { level: number; base: number; next: number } {
  let level = 1;
  let base = 0;
  while (true) {
    const cost = level * 50;
    if (t < base + cost) return { level, base, next: base + cost };
    base += cost;
    level += 1;
  }
}

export default function KingdomLevelBar() {
  const { trophies } = useTrophies();
  const { level, base, next } = levelForTrophies(trophies);
  const progress = (trophies - base) / (next - base);
  const pct = Math.max(0, Math.min(1, progress));

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
          {trophies} / {next}
        </div>
      </div>
    </div>
  );
}
