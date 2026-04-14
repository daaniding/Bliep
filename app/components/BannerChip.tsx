'use client';

interface Props {
  variant: 'gold' | 'blood' | 'magic';
  value: number;
  label: string;
  href?: string;
}

// Upgraded hanging banner chip. Wider banner body, bigger centre numbers
// in Lilita One, thicker gold trim, an inset pill with the value, side
// tassels, cloth folds. Hung from a rope with a visible knot.
export default function BannerChip({ variant, value, label, href }: Props) {
  const palette = PALETTES[variant];
  const content = (
    <div className={`hanging-banner ${variant}`}>
      {/* Rope — short hanger */}
      <svg width="60" height="14" viewBox="0 0 60 14" aria-hidden>
        <line x1="12" y1="0" x2="16" y2="12" stroke="#3d2813" strokeWidth="2" strokeLinecap="round" />
        <line x1="48" y1="0" x2="44" y2="12" stroke="#3d2813" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Banner cloth — smaller than before */}
      <svg width="72" height="62" viewBox="0 0 110 96" aria-hidden style={{ marginTop: -4 }}>
        <defs>
          <linearGradient id={`bannerFill-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="55%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.bottom} />
          </linearGradient>
          <linearGradient id={`bannerHighlight-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`topBar-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a4f2a" />
            <stop offset="100%" stopColor="#3d2813" />
          </linearGradient>
        </defs>

        {/* Wooden top rail with rivets */}
        <rect x="2" y="0" width="106" height="12" rx="2" fill={`url(#topBar-${variant})`} stroke="#0d0a06" strokeWidth="2" />
        <rect x="5" y="2" width="100" height="2" fill="#9b6838" opacity="0.6" />
        <circle cx="10" cy="6" r="1.8" fill="#f0b840" stroke="#0d0a06" strokeWidth="0.7" />
        <circle cx="100" cy="6" r="1.8" fill="#f0b840" stroke="#0d0a06" strokeWidth="0.7" />
        <circle cx="55" cy="6" r="1.8" fill="#f0b840" stroke="#0d0a06" strokeWidth="0.7" />

        {/* Banner body — tapered V bottom */}
        <path
          d="M6 12 L104 12 L104 68 L55 86 L6 68 Z"
          fill={`url(#bannerFill-${variant})`}
          stroke="#0d0a06"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Inner gold border (offset inward) */}
        <path
          d="M10 14 L100 14 L100 66 L55 82 L10 66 Z"
          fill="none"
          stroke="#f0b840"
          strokeWidth="2"
          opacity="0.9"
          strokeLinejoin="round"
        />
        {/* Top highlight sheen */}
        <path
          d="M12 14 L100 14 L100 34 L55 44 L12 34 Z"
          fill={`url(#bannerHighlight-${variant})`}
        />

        {/* Cloth fold lines — subtle vertical wrinkles */}
        <g stroke="rgba(0,0,0,0.15)" strokeWidth="1">
          <line x1="28" y1="16" x2="32" y2="68" />
          <line x1="78" y1="16" x2="74" y2="68" />
        </g>

        {/* Side tassels */}
        <circle cx="4"   cy="68" r="3.5" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.2" />
        <circle cx="106" cy="68" r="3.5" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.2" />

        {/* Value — big Lilita One with strong dark stroke */}
        <text
          x="55"
          y="48"
          textAnchor="middle"
          fontFamily="Lilita One, sans-serif"
          fontSize="26"
          fill="#fff6dc"
          stroke="#0d0a06"
          strokeWidth="2.5"
          paintOrder="stroke fill"
          fontWeight="400"
          style={{ letterSpacing: '0.02em' }}
        >
          {value}
        </text>

        {/* Small label under the value */}
        <text
          x="55"
          y="62"
          textAnchor="middle"
          fontFamily="Lilita One, sans-serif"
          fontSize="9"
          fill="#fff6dc"
          stroke="#0d0a06"
          strokeWidth="1"
          paintOrder="stroke fill"
          opacity="0.92"
          style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
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

const PALETTES: Record<Props['variant'], { top: string; mid: string; bottom: string }> = {
  gold:  { top: '#fdd069', mid: '#d19225', bottom: '#6e4c10' },
  blood: { top: '#ef7336', mid: '#c0392b', bottom: '#4a0800' },
  magic: { top: '#b080e0', mid: '#7a4abf', bottom: '#2a0f3d' },
};
