'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTrophies } from '@/lib/useTrophies';
import { loadCity } from '@/lib/cityStore';

// Hero "city banner" — small isometric-ish painted scene of the
// kingdom (castle + flag + houses + gate) on a dark amber background.
// Animated: flag waves, smoke rises from the chimney, torches flicker.
//
// This is the emotional anchor of the home screen: the player sees
// what they're working toward. Tap to navigate to /stad.

function levelForTrophies(t: number): number {
  let level = 1;
  let base = 0;
  while (true) {
    const cost = level * 50;
    if (t < base + cost) return level;
    base += cost;
    level += 1;
  }
}

export default function CityBanner() {
  const { trophies } = useTrophies();
  const [inhabitants, setInhabitants] = useState(0);
  const level = levelForTrophies(trophies);

  // Hydrate inhabitants client-side so SSR / hydration stays clean.
  useEffect(() => {
    try {
      const city = loadCity();
      const totalLevels = (city?.buildings ?? []).reduce(
        (sum: number, b: { level?: number }) => sum + (b?.level ?? 0),
        0,
      );
      setInhabitants(totalLevels * 8);
    } catch { /* ignore */ }
  }, []);

  return (
    <Link
      href="/stad"
      aria-label="Naar je stad"
      className="block w-full active:brightness-110 transition-all"
      style={{
        WebkitTapHighlightColor: 'transparent',
        textDecoration: 'none',
      }}
    >
      <div
        className="city-banner relative w-full overflow-hidden"
        style={{
          height: '35vh',
          minHeight: 240,
          maxHeight: 360,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(240, 184, 64, 0.28), transparent 60%), ' +
            'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(120, 40, 80, 0.4), transparent 70%), ' +
            'linear-gradient(180deg, #1a0a18 0%, #2a1505 50%, #0d0a06 100%)',
          borderBottom: '3px solid #0d0a06',
          boxShadow: 'inset 0 -8px 20px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Stars in the night sky */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {[
            { left: '8%', top: '12%', size: 1.5 },
            { left: '22%', top: '8%', size: 2 },
            { left: '38%', top: '15%', size: 1.5 },
            { left: '60%', top: '6%', size: 2 },
            { left: '74%', top: '14%', size: 1.5 },
            { left: '88%', top: '10%', size: 2 },
            { left: '15%', top: '22%', size: 1 },
            { left: '50%', top: '18%', size: 1 },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: `0 0 ${s.size * 4}px rgba(255, 255, 255, 0.9)`,
                opacity: 0.85,
                animation: `softPulse ${2 + i * 0.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* === City SVG scene === */}
        <svg
          className="absolute left-1/2 bottom-0 -translate-x-1/2"
          viewBox="0 0 400 220"
          width="100%"
          height="80%"
          style={{ maxWidth: 460 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="cb-castle-stone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9b7d50" />
              <stop offset="0.5" stopColor="#6e5530" />
              <stop offset="1" stopColor="#3a2a14" />
            </linearGradient>
            <linearGradient id="cb-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d04a30" />
              <stop offset="1" stopColor="#7a1f12" />
            </linearGradient>
            <linearGradient id="cb-house" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a06840" />
              <stop offset="1" stopColor="#5a3214" />
            </linearGradient>
            <linearGradient id="cb-house-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b8442e" />
              <stop offset="1" stopColor="#5a1a10" />
            </linearGradient>
            <radialGradient id="cb-window-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff8c0" />
              <stop offset="1" stopColor="#ffaa30" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="cb-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2410" />
              <stop offset="1" stopColor="#0d0a06" />
            </linearGradient>
          </defs>

          {/* Distant rolling hills silhouette */}
          <path
            d="M0 180 Q60 160 120 170 T240 165 T360 172 T400 168 L400 220 L0 220 Z"
            fill="#1a0f05"
            opacity="0.75"
          />
          <path
            d="M0 195 Q80 178 160 188 T320 184 T400 190 L400 220 L0 220 Z"
            fill="#0d0a06"
          />

          {/* === Left house === */}
          <g>
            <rect x="40" y="148" width="48" height="44" fill="url(#cb-house)" stroke="#0d0a06" strokeWidth="1.8" />
            <polygon points="36,148 92,148 64,124" fill="url(#cb-house-roof)" stroke="#0d0a06" strokeWidth="1.8" strokeLinejoin="round" />
            {/* chimney */}
            <rect x="74" y="120" width="8" height="14" fill="#5a3214" stroke="#0d0a06" strokeWidth="1.4" />
            {/* smoke from chimney */}
            <g className="cb-smoke">
              <ellipse cx="78" cy="112" rx="4" ry="3" fill="#a09080" opacity="0.8" />
              <ellipse cx="76" cy="104" rx="5" ry="3.5" fill="#9a8a7a" opacity="0.65" />
              <ellipse cx="79" cy="94" rx="6" ry="4" fill="#908070" opacity="0.5" />
              <ellipse cx="76" cy="84" rx="7" ry="4.5" fill="#857a6a" opacity="0.35" />
              <ellipse cx="79" cy="72" rx="8" ry="5" fill="#7a7060" opacity="0.2" />
            </g>
            {/* glowing window */}
            <rect x="50" y="160" width="10" height="12" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="50" y="160" width="10" height="12" fill="url(#cb-window-glow)" />
            {/* door */}
            <rect x="68" y="170" width="10" height="22" fill="#3a1f08" stroke="#0d0a06" strokeWidth="1.4" />
          </g>

          {/* === Center castle === */}
          <g>
            {/* castle main body */}
            <rect x="140" y="100" width="120" height="92" fill="url(#cb-castle-stone)" stroke="#0d0a06" strokeWidth="2" />
            {/* battlements top */}
            <g fill="url(#cb-castle-stone)" stroke="#0d0a06" strokeWidth="1.6">
              <rect x="140" y="92" width="14" height="10" />
              <rect x="160" y="92" width="14" height="10" />
              <rect x="180" y="92" width="14" height="10" />
              <rect x="200" y="92" width="14" height="10" />
              <rect x="220" y="92" width="14" height="10" />
              <rect x="240" y="92" width="14" height="10" />
            </g>
            {/* left tower */}
            <rect x="124" y="84" width="22" height="108" fill="url(#cb-castle-stone)" stroke="#0d0a06" strokeWidth="2" />
            <polygon points="118,84 152,84 135,60" fill="url(#cb-roof)" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
            {/* right tower */}
            <rect x="254" y="84" width="22" height="108" fill="url(#cb-castle-stone)" stroke="#0d0a06" strokeWidth="2" />
            <polygon points="248,84 282,84 265,60" fill="url(#cb-roof)" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
            {/* central tower (taller) */}
            <rect x="186" y="58" width="28" height="34" fill="url(#cb-castle-stone)" stroke="#0d0a06" strokeWidth="2" />
            <polygon points="180,58 220,58 200,28" fill="url(#cb-roof)" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />

            {/* Flag pole */}
            <line x1="200" y1="28" x2="200" y2="10" stroke="#0d0a06" strokeWidth="2" strokeLinecap="round" />
            {/* Waving flag — the path animates via CSS keyframes */}
            <g className="cb-flag" style={{ transformOrigin: '200px 14px' }}>
              <path
                d="M200 10 L222 14 Q224 18 222 22 L200 22 Z"
                fill="#c0392b"
                stroke="#0d0a06"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="208" cy="16" r="2" fill="#fdd069" />
            </g>

            {/* Castle gate (the dark archway) */}
            <path
              d="M188 192 L188 156 Q188 140 200 140 Q212 140 212 156 L212 192 Z"
              fill="#0d0a06"
              stroke="#0d0a06"
              strokeWidth="1.8"
            />
            {/* Gate vertical bars */}
            <line x1="194" y1="146" x2="194" y2="192" stroke="#3a1f08" strokeWidth="1.2" />
            <line x1="200" y1="142" x2="200" y2="192" stroke="#3a1f08" strokeWidth="1.2" />
            <line x1="206" y1="146" x2="206" y2="192" stroke="#3a1f08" strokeWidth="1.2" />

            {/* Castle windows with glow */}
            {[
              { x: 156, y: 130 },
              { x: 232, y: 130 },
              { x: 156, y: 158 },
              { x: 232, y: 158 },
            ].map((w, i) => (
              <g key={i}>
                <rect x={w.x} y={w.y} width="10" height="12" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.4" />
                <rect x={w.x} y={w.y} width="10" height="12" fill="url(#cb-window-glow)" />
              </g>
            ))}
            {/* central tower window */}
            <rect x="194" y="68" width="12" height="14" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="194" y="68" width="12" height="14" fill="url(#cb-window-glow)" />

            {/* Torches on either side of the gate */}
            <g className="cb-torch">
              <rect x="170" y="170" width="2" height="14" fill="#3a1f08" />
              <ellipse cx="171" cy="168" rx="3" ry="5" fill="#ff8a3a" />
              <ellipse cx="171" cy="167" rx="2" ry="3.5" fill="#fff8c0" />
            </g>
            <g className="cb-torch" style={{ animationDelay: '-0.4s' }}>
              <rect x="228" y="170" width="2" height="14" fill="#3a1f08" />
              <ellipse cx="229" cy="168" rx="3" ry="5" fill="#ff8a3a" />
              <ellipse cx="229" cy="167" rx="2" ry="3.5" fill="#fff8c0" />
            </g>
          </g>

          {/* === Right house === */}
          <g>
            <rect x="312" y="156" width="44" height="36" fill="url(#cb-house)" stroke="#0d0a06" strokeWidth="1.8" />
            <polygon points="308,156 360,156 334,134" fill="url(#cb-house-roof)" stroke="#0d0a06" strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="320" y="166" width="9" height="10" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="320" y="166" width="9" height="10" fill="url(#cb-window-glow)" />
            <rect x="338" y="174" width="10" height="18" fill="#3a1f08" stroke="#0d0a06" strokeWidth="1.4" />
          </g>

          {/* Foreground ground sliver */}
          <rect x="0" y="190" width="400" height="30" fill="url(#cb-ground)" />
        </svg>

        {/* Caption: city level + inhabitants */}
        <div
          className="absolute left-0 right-0 bottom-0 px-4 pb-2 pointer-events-none flex items-center justify-center gap-3"
          style={{ zIndex: 5 }}
        >
          <span
            className="font-display"
            style={{
              fontSize: 11,
              color: '#fdd069',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textShadow: '0 1.5px 0 #0d0a06, 0 0 10px rgba(240, 184, 64, 0.55)',
            }}
          >
            Stad level {level}
          </span>
          <span
            className="font-display"
            style={{
              fontSize: 11,
              color: '#f4e6b8',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.8,
              textShadow: '0 1.5px 0 #0d0a06',
            }}
          >
            · {inhabitants} inwoners
          </span>
        </div>
      </div>
    </Link>
  );
}
