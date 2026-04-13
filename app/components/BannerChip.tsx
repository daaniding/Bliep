'use client';

interface Props {
  variant: 'gold' | 'blood' | 'magic';
  value: number;
  label: string;
  href?: string;
}

// Hanging banner chip — a short rope, a cloth banner with a gold border,
// and the value number inside. Sways gently via keyframes. Pure SVG so
// it scales crisply at any size.
export default function BannerChip({ variant, value, label, href }: Props) {
  const palette = PALETTES[variant];
  const content = (
    <div className={`hanging-banner ${variant}`}>
      {/* Rope */}
      <svg width="60" height="18" viewBox="0 0 60 18" aria-hidden>
        <line x1="6" y1="0" x2="10" y2="16" stroke="#3d2813" strokeWidth="2" strokeLinecap="round" />
        <line x1="54" y1="0" x2="50" y2="16" stroke="#3d2813" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Banner cloth */}
      <svg width="92" height="76" viewBox="0 0 92 76" aria-hidden style={{ marginTop: -4 }}>
        <defs>
          <linearGradient id={`bannerFill-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="100%" stopColor={palette.bottom} />
          </linearGradient>
          <linearGradient id={`bannerHighlight-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Wooden top bar */}
        <rect x="2" y="0" width="88" height="8" rx="2" fill="#5c3a1e" stroke="#1a0f05" strokeWidth="1.5" />
        <rect x="6" y="2" width="80" height="2" fill="#7a4f2a" opacity="0.7" />

        {/* Banner body — tapered to a V-bottom with inner highlight */}
        <path
          d="M8 8 L84 8 L84 54 L46 68 L8 54 Z"
          fill={`url(#bannerFill-${variant})`}
          stroke="#1a0f05"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M12 10 L80 10 L80 38 L46 50 L12 38 Z"
          fill={`url(#bannerHighlight-${variant})`}
        />

        {/* Gold trim */}
        <path
          d="M8 8 L84 8 L84 54 L46 68 L8 54 Z"
          fill="none"
          stroke="#f0b840"
          strokeWidth="1.5"
          opacity="0.85"
        />

        {/* Side tassels */}
        <circle cx="4" cy="54" r="2.5" fill="#f0b840" stroke="#1a0f05" strokeWidth="1" />
        <circle cx="88" cy="54" r="2.5" fill="#f0b840" stroke="#1a0f05" strokeWidth="1" />

        {/* Value text */}
        <text
          x="46"
          y="34"
          textAnchor="middle"
          fontFamily="Lilita One, sans-serif"
          fontSize="18"
          fill="#fff6dc"
          stroke="#1a0f05"
          strokeWidth="1.5"
          paintOrder="stroke fill"
          fontWeight="400"
        >
          <tspan>{value}</tspan>
        </text>

        {/* Tiny label */}
        <text
          x="46"
          y="46"
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontSize="7"
          fill="#fff6dc"
          opacity="0.8"
          fontWeight="800"
          letterSpacing="0.5"
          style={{ textTransform: 'uppercase' }}
        >
          {label}
        </text>
      </svg>
    </div>
  );

  if (href) {
    return <a href={href} className="pointer-events-auto">{content}</a>;
  }
  return content;
}

const PALETTES: Record<Props['variant'], { top: string; bottom: string }> = {
  gold:  { top: '#f0b840', bottom: '#6e4c10' },
  blood: { top: '#c0392b', bottom: '#3d0a00' },
  magic: { top: '#8a4bbf', bottom: '#2a0f3d' },
};
