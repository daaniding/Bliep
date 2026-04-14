'use client';

import GameShell from '../components/GameShell';

export default function BattlePage() {
  return (
    <GameShell>
      <div
        className="flex flex-col items-center justify-center mx-auto text-center"
        style={{
          maxWidth: 420,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 96px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 130px)',
          paddingLeft: 24,
          paddingRight: 24,
          minHeight: '100dvh',
          gap: 24,
        }}
      >
        {/* Sealed gate illustration */}
        <div className="animate-fade-up" style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.7))' }}>
          <svg viewBox="0 0 220 240" width="220" height="240" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gate-stone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9b7d50" />
                <stop offset="1" stopColor="#3a2a14" />
              </linearGradient>
              <linearGradient id="gate-wood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7a4a1f" />
                <stop offset="1" stopColor="#1a0f05" />
              </linearGradient>
            </defs>
            {/* Outer arch wall */}
            <rect x="20" y="40" width="180" height="180" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="3" />
            {/* Battlements */}
            <rect x="20" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            <rect x="48" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            <rect x="76" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            <rect x="122" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            <rect x="150" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            <rect x="178" y="34" width="22" height="10" fill="url(#gate-stone)" stroke="#0d0a06" strokeWidth="2" />
            {/* Gate opening — arched */}
            <path
              d="M62 220 L62 130 Q62 80 110 80 Q158 80 158 130 L158 220 Z"
              fill="url(#gate-wood)"
              stroke="#0d0a06"
              strokeWidth="3"
            />
            {/* Vertical wood planks */}
            {[78, 92, 106, 120, 134, 148].map(x => (
              <line key={x} x1={x} y1="92" x2={x} y2="220" stroke="#0d0a06" strokeWidth="1.5" opacity="0.7" />
            ))}
            {/* Iron horizontal bands */}
            <rect x="62" y="120" width="96" height="6" fill="#3a3a42" stroke="#0d0a06" strokeWidth="1.5" />
            <rect x="62" y="180" width="96" height="6" fill="#3a3a42" stroke="#0d0a06" strokeWidth="1.5" />
            {/* Iron rivets */}
            {[
              [70, 123], [86, 123], [102, 123], [118, 123], [134, 123], [150, 123],
              [70, 183], [86, 183], [102, 183], [118, 183], [134, 183], [150, 183],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.6" fill="#7a7a82" stroke="#0d0a06" strokeWidth="0.6" />
            ))}
            {/* Big lock in the center */}
            <g>
              <rect x="98" y="148" width="24" height="24" rx="3" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="2" />
              <circle cx="110" cy="158" r="3" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.2" />
              <rect x="108.5" y="160" width="3" height="6" fill="#fdd069" stroke="#0d0a06" strokeWidth="1" />
            </g>
            {/* Crossed swords above the lock */}
            <g transform="translate(110 110)">
              <g transform="rotate(-30)">
                <rect x="-1" y="-22" width="2" height="34" fill="#d7d7d7" stroke="#0d0a06" strokeWidth="0.6" />
                <rect x="-3" y="12" width="6" height="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
              </g>
              <g transform="rotate(30)">
                <rect x="-1" y="-22" width="2" height="34" fill="#d7d7d7" stroke="#0d0a06" strokeWidth="0.6" />
                <rect x="-3" y="12" width="6" height="2" fill="#fdd069" stroke="#0d0a06" strokeWidth="0.6" />
              </g>
            </g>
          </svg>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <p
            className="font-display"
            style={{
              fontSize: 11,
              color: '#fdd069',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Niet beschikbaar
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 32,
              color: '#fff6dc',
              WebkitTextStroke: '2.5px #0d0a06',
              paintOrder: 'stroke fill',
              textShadow: '0 3px 0 #0d0a06',
              lineHeight: 1.1,
            }}
          >
            Battle komt eraan
          </h1>
        </div>

        <p
          className="font-body animate-fade-up"
          style={{
            fontSize: 14,
            color: '#f4e6b8',
            opacity: 0.85,
            lineHeight: 1.5,
            maxWidth: 320,
            animationDelay: '200ms',
          }}
        >
          Eerst je stad opbouwen, soldaat. Aanvallen op andere koninkrijken openen
          zodra je leger en muren klaar zijn.
        </p>
      </div>
    </GameShell>
  );
}
