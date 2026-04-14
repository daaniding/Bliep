'use client';

import { useTrophies } from '@/lib/useTrophies';

function levelForTrophies(t: number): { level: number; base: number; next: number } {
  let level = 1;
  let base = 0;
  // eslint-disable-next-line no-constant-condition
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
    <div className="flex items-stretch gap-2 pointer-events-auto">
      {/* Level badge — round 3D shield with number */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 32% 28%, #fff6dc 0%, #fdd069 22%, #f0b840 42%, #c8891e 70%, #6e4c10 100%)',
          border: '2.5px solid #0d0a06',
          boxShadow:
            'inset 0 2px 0 rgba(255, 255, 255, 0.7), ' +
            'inset 0 -3px 0 rgba(0, 0, 0, 0.35), ' +
            '0 3px 0 #6e4c10, ' +
            '0 5px 12px rgba(0, 0, 0, 0.7), ' +
            '0 0 18px rgba(240, 184, 64, 0.55)',
        }}
      >
        {/* Inner ring outline */}
        <div
          aria-hidden
          className="absolute"
          style={{
            inset: 3,
            borderRadius: '50%',
            border: '1.5px solid rgba(13, 10, 6, 0.45)',
            pointerEvents: 'none',
          }}
        />
        <span
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: '#2a1505',
            textShadow: '0 1px 0 rgba(255, 255, 255, 0.6)',
            position: 'relative',
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      </div>

      {/* Progress bar inside a tiny wood plank */}
      <div className="panel-wood flex-1 relative" style={{ padding: '5px 8px', minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            height: 14,
            borderRadius: 7,
            background: 'linear-gradient(180deg, #0d0a06 0%, #1a0f05 100%)',
            border: '1.5px solid #0d0a06',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.75)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct * 100}%`,
              height: '100%',
              background:
                'linear-gradient(180deg, #fff6dc 0%, #fdd069 18%, #f0b840 55%, #c8891e 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.7), ' +
                'inset 0 -2px 0 rgba(0,0,0,0.2), ' +
                '0 0 8px rgba(240,184,64,0.75)',
              transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center font-display"
            style={{
              fontSize: 10,
              color: '#fff6dc',
              letterSpacing: '0.04em',
              textShadow: '0 1px 0 rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.7)',
              lineHeight: 1,
            }}
          >
            {trophies} / {next}
          </div>
        </div>
        {/* Corner rivets */}
        <span className="rivet" style={{ top: 3, left: 3 }} />
        <span className="rivet" style={{ top: 3, right: 3 }} />
        <span className="rivet" style={{ bottom: 3, left: 3 }} />
        <span className="rivet" style={{ bottom: 3, right: 3 }} />
      </div>
    </div>
  );
}
