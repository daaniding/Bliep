'use client';

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, viewBox = '0 0 32 32', ...rest }: IconProps & { viewBox?: string }) {
  return {
    width: size,
    height: size,
    viewBox,
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'none',
    ...rest,
  };
}

const OUTLINE = '#0a0a0a';
const STROKE = 2;

/* ============================================================
 * Each icon is built from layered SVG: dark outline, body
 * gradient, then a top highlight shape for glass/metal sheen.
 * ============================================================ */

export function CoinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <radialGradient id="coin-rim" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#fff6dc" />
          <stop offset="55%" stopColor="#fdd069" />
          <stop offset="100%" stopColor="#8a5a10" />
        </radialGradient>
        <radialGradient id="coin-face" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#fff8c0" />
          <stop offset="55%" stopColor="#f0b840" />
          <stop offset="100%" stopColor="#a3701a" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#coin-rim)" stroke={OUTLINE} strokeWidth={STROKE} />
      <circle cx="16" cy="16" r="9" fill="url(#coin-face)" stroke={OUTLINE} strokeWidth="1.4" />
      <text x="16" y="21" textAnchor="middle" fontFamily="Lilita One, system-ui, sans-serif" fontSize="13" fill={OUTLINE} fontWeight="900">$</text>
      <path d="M11 9 Q9 12 9 16" stroke="#fff8c0" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

export function GemIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="gem-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8ffd0" />
          <stop offset="0.4" stopColor="#3dd285" />
          <stop offset="1" stopColor="#0e5a30" />
        </linearGradient>
      </defs>
      <path d="M16 3 L27 11 L21 28 L11 28 L5 11 Z" fill="url(#gem-body)" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M5 11 L27 11" stroke={OUTLINE} strokeWidth="1.4" />
      <path d="M11 11 L16 3 L21 11 L16 28 Z" fill="rgba(255,255,255,0.18)" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M9 7 Q12 5 14 5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="trophy-cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8c0" />
          <stop offset="0.5" stopColor="#f0b840" />
          <stop offset="1" stopColor="#7a4f10" />
        </linearGradient>
      </defs>
      <path d="M10 5 H22 V13 Q22 19 16 19 Q10 19 10 13 Z" fill="url(#trophy-cup)" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M10 7 Q4 7 4 11 Q4 15 9 17" stroke={OUTLINE} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <path d="M22 7 Q28 7 28 11 Q28 15 23 17" stroke={OUTLINE} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <rect x="13" y="19" width="6" height="4" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="9" y="23" width="14" height="4" rx="1" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} />
      <path d="M13 8 Q13 12 16 13" stroke="#fff8c0" strokeWidth="1.4" fill="none" opacity="0.9" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="flame-out" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe070" />
          <stop offset="0.3" stopColor="#ff8a3a" />
          <stop offset="1" stopColor="#a02a08" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 Q10 10 10 16 Q10 23 16 28 Q22 23 22 16 Q22 12 19 8 Q18 12 16 13 Q15 9 16 3 Z"
        fill="url(#flame-out)"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M16 12 Q13 16 13 19 Q13 23 16 26 Q19 23 19 19 Q19 16 16 12 Z"
        fill="#ffd070"
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="shield-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8c0" />
          <stop offset="0.4" stopColor="#f0b840" />
          <stop offset="1" stopColor="#7a4f10" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 L27 6 L27 15 Q27 24 16 29 Q5 24 5 15 L5 6 Z"
        fill="url(#shield-body)"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path d="M16 6 L24 8 L24 15 Q24 21 16 25 Q8 21 8 15 L8 8 Z" fill="#7a1e0a" stroke={OUTLINE} strokeWidth="1.4" />
      <path d="M16 11 L16 19 M12 15 L20 15" stroke="#fdd069" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 9 Q11 7 14 7" stroke="#fff8c0" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  );
}

export function CastleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="castle-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8b888" />
          <stop offset="1" stopColor="#5a3214" />
        </linearGradient>
      </defs>
      <rect x="6" y="14" width="20" height="14" fill="url(#castle-wall)" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="3" y="9" width="6" height="19" fill="url(#castle-wall)" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="23" y="9" width="6" height="19" fill="url(#castle-wall)" stroke={OUTLINE} strokeWidth={STROKE} />
      <path d="M3 9 L3 6 L5 6 L5 9 M7 9 L7 6 L9 6 L9 9" stroke={OUTLINE} strokeWidth="1.4" fill={OUTLINE} />
      <path d="M23 9 L23 6 L25 6 L25 9 M27 9 L27 6 L29 6 L29 9" stroke={OUTLINE} strokeWidth="1.4" fill={OUTLINE} />
      <polygon points="6,14 9,10 12,14" fill="#c0392b" stroke={OUTLINE} strokeWidth="1.4" />
      <polygon points="20,14 23,10 26,14" fill="#c0392b" stroke={OUTLINE} strokeWidth="1.4" />
      <rect x="14" y="19" width="4" height="9" fill="#0a0a0a" />
      <rect x="14" y="19" width="4" height="2" fill="#f0b840" />
    </svg>
  );
}

export function ChestIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="chest-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c08038" />
          <stop offset="0.55" stopColor="#8a5224" />
          <stop offset="1" stopColor="#3a1c08" />
        </linearGradient>
        <linearGradient id="chest-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d89248" />
          <stop offset="1" stopColor="#7a4418" />
        </linearGradient>
      </defs>
      <ellipse cx="16" cy="29" rx="13" ry="1.5" fill="rgba(0,0,0,0.5)" />
      <path d="M4 17 L28 17 L28 27 Q28 28 27 28 L5 28 Q4 28 4 27 Z" fill="url(#chest-body)" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M4 17 Q4 7 16 7 Q28 7 28 17 Z" fill="url(#chest-lid)" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <rect x="4" y="16" width="24" height="2.6" fill="#f0b840" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="13" y="17" width="6" height="8" rx="1" fill="#fdd069" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="16" cy="20.5" r="1" fill={OUTLINE} />
      <rect x="15.5" y="20.5" width="1" height="3" fill={OUTLINE} />
      <path d="M7 12 Q10 9 14 9" stroke="#fff8c0" strokeWidth="1.2" fill="none" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="lock-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfd6dc" />
          <stop offset="0.5" stopColor="#7e8a96" />
          <stop offset="1" stopColor="#2f3640" />
        </linearGradient>
      </defs>
      <path d="M10 14 V10 Q10 5 16 5 Q22 5 22 10 V14" stroke={OUTLINE} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <rect x="6" y="14" width="20" height="14" rx="2.5" fill="url(#lock-body)" stroke={OUTLINE} strokeWidth={STROKE} />
      <circle cx="16" cy="20" r="2.4" fill={OUTLINE} />
      <rect x="15" y="20" width="2" height="5.5" fill={OUTLINE} />
      <path d="M8 16 Q10 15 12 15.5" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

export function SwordIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="sword-blade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#cfd6dc" />
          <stop offset="1" stopColor="#5a6470" />
        </linearGradient>
      </defs>
      <path d="M21 4 L28 4 L28 11 L14 25 L8 25 L8 19 Z" fill="url(#sword-blade)" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M21 4 L28 4 L28 11 Z" fill="#fdd069" />
      <rect x="5" y="22" width="10" height="3" rx="1" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} transform="rotate(-45 10 23.5)" />
      <rect x="3" y="25" width="6" height="3" rx="1" fill="#f0b840" stroke={OUTLINE} strokeWidth={STROKE} transform="rotate(-45 6 26.5)" />
    </svg>
  );
}

export function ScrollIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id="scroll-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="1" stopColor="#d6b67a" />
        </linearGradient>
      </defs>
      <rect x="6" y="7" width="20" height="18" rx="1.5" fill="url(#scroll-body)" stroke={OUTLINE} strokeWidth={STROKE} />
      <line x1="10" y1="12" x2="22" y2="12" stroke="#7a4f10" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="10" y1="16" x2="22" y2="16" stroke="#7a4f10" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="10" y1="20" x2="18" y2="20" stroke="#7a4f10" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="6" cy="16" rx="2.5" ry="9" fill="#9b6838" stroke={OUTLINE} strokeWidth={STROKE} />
      <ellipse cx="26" cy="16" rx="2.5" ry="9" fill="#9b6838" stroke={OUTLINE} strokeWidth={STROKE} />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <radialGradient id="gear-body" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#cfd6dc" />
          <stop offset="0.7" stopColor="#7e8a96" />
          <stop offset="1" stopColor="#2f3640" />
        </radialGradient>
      </defs>
      <g>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect
            key={a}
            x="14"
            y="2"
            width="4"
            height="6"
            fill="#7e8a96"
            stroke={OUTLINE}
            strokeWidth="1.4"
            transform={`rotate(${a} 16 16)`}
          />
        ))}
      </g>
      <circle cx="16" cy="16" r="9" fill="url(#gear-body)" stroke={OUTLINE} strokeWidth={STROKE} />
      <circle cx="16" cy="16" r="3.4" fill={OUTLINE} />
      <path d="M9 12 Q11 10 14 10" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <defs>
        <radialGradient id="star-body" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff8c0" />
          <stop offset="0.55" stopColor="#fdd069" />
          <stop offset="1" stopColor="#7a4f10" />
        </radialGradient>
      </defs>
      <path
        d="M16 3 L19.5 12 L29 12 L21.5 18 L24.5 27 L16 21.5 L7.5 27 L10.5 18 L3 12 L12.5 12 Z"
        fill="url(#star-body)"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path d="M11 10 Q14 7 16 6" stroke="#fff8c0" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  );
}
