'use client';

import { ReactNode } from 'react';

interface Props {
  ribbonText: string;
  children: ReactNode;
}

// Heraldic corner ornament — a quarter-circle filigree with an inner dot.
// Gold gradient + drop shadow for that "hammered metal" feel.
function CornerOrnament({ rotate }: { rotate: number }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      style={{ transform: `rotate(${rotate}deg)`, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}
    >
      <defs>
        <linearGradient id={`gradOrn${rotate}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE99A" />
          <stop offset="0.4" stopColor="#F5D068" />
          <stop offset="1" stopColor="#A77526" />
        </linearGradient>
      </defs>
      <g fill={`url(#gradOrn${rotate})`} stroke="#7C521A" strokeWidth="0.6">
        {/* Outer L bracket */}
        <path d="M2 2 L14 2 L14 6 L6 6 L6 14 L2 14 Z" />
        {/* Inner curl */}
        <path d="M8 8 Q12 8 12 12 L11 12 Q11 9 8 9 Z" />
        {/* Centre dot */}
        <circle cx="4.5" cy="4.5" r="1.4" fill="#FFE99A" />
      </g>
    </svg>
  );
}

// The signature centerpiece: thick gold frame with corner ornaments,
// parchment panel inside, heraldic ribbon banner on top.
export default function HeroPanel({ ribbonText, children }: Props) {
  return (
    <div className="relative pt-5">
      {/* Heraldic ribbon, sits on top of the frame border */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 z-20 pointer-events-none">
        <span className="ribbon">{ribbonText}</span>
      </div>

      <div className="gold-frame-xl mt-3 relative">
        {/* Corner ornaments */}
        <div className="absolute top-1 left-1 z-10"><CornerOrnament rotate={0} /></div>
        <div className="absolute top-1 right-1 z-10"><CornerOrnament rotate={90} /></div>
        <div className="absolute bottom-1 right-1 z-10"><CornerOrnament rotate={180} /></div>
        <div className="absolute bottom-1 left-1 z-10"><CornerOrnament rotate={270} /></div>

        <div className="parchment-panel p-5 pt-7">
          {children}
        </div>
      </div>
    </div>
  );
}
