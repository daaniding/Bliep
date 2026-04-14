'use client';

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'none',
    ...rest,
  };
}

const OUTLINE = '#1a0f05';
const STROKE = 2.2;

export function CoinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="16" cy="16" r="12" fill="#f0b840" stroke={OUTLINE} strokeWidth={STROKE} />
      <circle cx="16" cy="16" r="8.5" fill="#fdd069" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M13 10 Q11 13 11 16 Q11 20 13 22" stroke="#fff6dc" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" fill="none" />
      <text x="16" y="21" textAnchor="middle" fontFamily="Lilita One, system-ui" fontSize="11" fill={OUTLINE}>$</text>
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 5 H22 V13 Q22 19 16 19 Q10 19 10 13 Z" fill="#f0b840" stroke={OUTLINE} strokeWidth={STROKE} />
      <path d="M10 7 Q4 7 4 11 Q4 15 8 16" stroke={OUTLINE} strokeWidth={STROKE} fill="none" />
      <path d="M22 7 Q28 7 28 11 Q28 15 24 16" stroke={OUTLINE} strokeWidth={STROKE} fill="none" />
      <rect x="13" y="19" width="6" height="4" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="9" y="23" width="14" height="4" rx="1" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} />
      <path d="M13 8 Q13 12 16 13" stroke="#fff6dc" strokeWidth="1.4" fill="none" opacity="0.85" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M16 3 Q10 10 10 16 Q10 23 16 28 Q22 23 22 16 Q22 12 19 8 Q18 12 16 13 Q15 9 16 3 Z"
        fill="#ff8a3a"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M16 12 Q13 16 13 19 Q13 23 16 26 Q19 23 19 19 Q19 16 16 12 Z"
        fill="#ffd070"
        stroke={OUTLINE}
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function SwordIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 4 L28 4 L28 11 L14 25 L8 25 L8 19 Z" fill="#e0e0e0" stroke={OUTLINE} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M21 4 L28 4 L28 11 Z" fill="#fdd069" />
      <rect x="5" y="22" width="10" height="3" rx="1" fill="#c8891e" stroke={OUTLINE} strokeWidth={STROKE} transform="rotate(-45 10 23.5)" />
      <rect x="3" y="25" width="6" height="3" rx="1" fill="#f0b840" stroke={OUTLINE} strokeWidth={STROKE} transform="rotate(-45 6 26.5)" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M16 3 L27 6 L27 15 Q27 24 16 29 Q5 24 5 15 L5 6 Z"
        fill="#f0b840"
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M16 6 L24 8 L24 15 Q24 21 16 25 Q8 21 8 15 L8 8 Z"
        fill="#7a1e0a"
        stroke={OUTLINE}
        strokeWidth="1.6"
      />
      <path d="M16 11 L16 19 M12 15 L20 15" stroke="#fdd069" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function CastleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="14" width="20" height="14" fill="#9b6838" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="3" y="9" width="6" height="19" fill="#b07844" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="23" y="9" width="6" height="19" fill="#b07844" stroke={OUTLINE} strokeWidth={STROKE} />
      <path d="M3 9 L3 6 L5 6 L5 9 M7 9 L7 6 L9 6 L9 9" stroke={OUTLINE} strokeWidth="1.6" fill="#1a0f05" />
      <path d="M23 9 L23 6 L25 6 L25 9 M27 9 L27 6 L29 6 L29 9" stroke={OUTLINE} strokeWidth="1.6" fill="#1a0f05" />
      <polygon points="6,14 9,10 12,14" fill="#c0392b" stroke={OUTLINE} strokeWidth="1.6" />
      <polygon points="20,14 23,10 26,14" fill="#c0392b" stroke={OUTLINE} strokeWidth="1.6" />
      <rect x="14" y="19" width="4" height="9" fill="#1a0f05" />
      <rect x="14" y="19" width="4" height="2" fill="#f0b840" />
    </svg>
  );
}

export function ChestIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 14 Q5 8 16 8 Q27 8 27 14 L27 16 L5 16 Z" fill="#9b6838" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="5" y="15" width="22" height="12" fill="#7a4f2a" stroke={OUTLINE} strokeWidth={STROKE} />
      <rect x="5" y="15" width="22" height="2.5" fill="#f0b840" stroke={OUTLINE} strokeWidth="1.4" />
      <rect x="5" y="25" width="22" height="2" fill="#f0b840" stroke={OUTLINE} strokeWidth="1.4" />
      <rect x="13" y="17" width="6" height="8" fill="#f0b840" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="16" cy="21" r="1.4" fill={OUTLINE} />
      <path d="M8 11 Q10 10 12 11 M20 11 Q22 10 24 11" stroke="#fff6dc" strokeWidth="1.2" fill="none" opacity="0.6" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 14 V10 Q10 5 16 5 Q22 5 22 10 V14" stroke={OUTLINE} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <rect x="6" y="14" width="20" height="14" rx="2" fill="#8e8472" stroke={OUTLINE} strokeWidth={STROKE} />
      <circle cx="16" cy="20" r="2.2" fill={OUTLINE} />
      <rect x="15" y="20" width="2" height="5" fill={OUTLINE} />
    </svg>
  );
}
