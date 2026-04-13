'use client';

import { useRef } from 'react';

interface Props {
  taskText: string | null;
  durationMin?: number;
  tierLabel?: string;
  onTap: () => void;
  disabled?: boolean;
}

// A ridder longsword that sits horizontally. The hilt is gold with a
// glowing ruby in the pommel; the blade is silver. When a task is
// chosen, its text is engraved on the blade. Tap anywhere = onTap.
// On tap we fire a gem-flash animation.
export default function SwordCTA({ taskText, durationMin, tierLabel, onTap, disabled }: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);

  function handleTap() {
    if (disabled) return;
    const root = rootRef.current;
    if (root) {
      // Kick off a brief flash animation via a short lifecycle class
      root.animate(
        [
          { filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,200,80,0))' },
          { filter: 'brightness(1.35) drop-shadow(0 0 36px rgba(255,200,80,0.95))', offset: 0.4 },
          { filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,200,80,0))' },
        ],
        { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
    onTap();
  }

  return (
    <button
      ref={rootRef}
      onClick={handleTap}
      disabled={disabled}
      aria-label={taskText ? `Start: ${taskText}` : 'Kies een opdracht'}
      className="block w-full active:scale-[0.98] transition-transform"
      style={{ background: 'transparent', border: 0, padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <svg viewBox="0 0 440 90" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)]">
        <defs>
          {/* Silver blade gradient */}
          <linearGradient id="swBlade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#fdfdfd" />
            <stop offset="30%" stopColor="#d7d7d7" />
            <stop offset="50%" stopColor="#a8a8a8" />
            <stop offset="70%" stopColor="#6a6a6a" />
            <stop offset="100%" stopColor="#303030" />
          </linearGradient>
          {/* Blade highlight stripe */}
          <linearGradient id="swBladeStripe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Gold hilt */}
          <linearGradient id="swGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#fff6dc" />
            <stop offset="25%" stopColor="#fdd069" />
            <stop offset="60%" stopColor="#d19225" />
            <stop offset="100%" stopColor="#6e4c10" />
          </linearGradient>
          {/* Ruby gem */}
          <radialGradient id="swRuby" cx="0.35" cy="0.3" r="0.7">
            <stop offset="0%"  stopColor="#ffd9c8" />
            <stop offset="20%" stopColor="#ff7050" />
            <stop offset="65%" stopColor="#b01810" />
            <stop offset="100%" stopColor="#3a0600" />
          </radialGradient>
          {/* Leather grip */}
          <linearGradient id="swLeather" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c3a1e" />
            <stop offset="100%" stopColor="#2a1a0a" />
          </linearGradient>
        </defs>

        {/* === Blade ===
            Blade body: pointy tip on the RIGHT, connects to hilt on the left.
            Shape: triangle with a long rectangular base, slight fuller (central groove). */}

        {/* Blade outer */}
        <path
          d="M120 30 L400 32 L432 45 L400 58 L120 60 Q108 60 108 45 Q108 30 120 30 Z"
          fill="url(#swBlade)"
          stroke="#0d0a06"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Fuller (central groove) */}
        <path
          d="M132 42 L398 42 M132 48 L398 48"
          stroke="#606060"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Blade highlight stripe */}
        <path d="M135 34 L395 34 L395 40 L135 40 Z" fill="url(#swBladeStripe)" />

        {/* Engraved task text along the blade */}
        {taskText && (
          <text
            x="260"
            y="49"
            textAnchor="middle"
            fontFamily="Lilita One, sans-serif"
            fontSize="12"
            fill="#1a0f05"
            stroke="none"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            {truncate(taskText, 36)}
          </text>
        )}

        {/* === Cross-guard === */}
        <rect x="92" y="18" width="14" height="54" rx="2" fill="url(#swGold)" stroke="#0d0a06" strokeWidth="2" />
        {/* Decorative arms of the cross-guard sticking out top/bottom */}
        <polygon points="92,18 106,18 108,14 90,14" fill="url(#swGold)" stroke="#0d0a06" strokeWidth="1.5" />
        <polygon points="92,72 106,72 108,76 90,76" fill="url(#swGold)" stroke="#0d0a06" strokeWidth="1.5" />
        {/* Cross-guard center detail */}
        <circle cx="99" cy="45" r="4" fill="#fdd069" stroke="#0d0a06" strokeWidth="1.2" />

        {/* === Leather grip === */}
        <rect x="68" y="33" width="24" height="24" fill="url(#swLeather)" stroke="#0d0a06" strokeWidth="2" />
        {/* Grip wrap lines */}
        <g stroke="#1a0f05" strokeWidth="1">
          <line x1="70" y1="36" x2="90" y2="36" />
          <line x1="70" y1="40" x2="90" y2="40" />
          <line x1="70" y1="44" x2="90" y2="44" />
          <line x1="70" y1="48" x2="90" y2="48" />
          <line x1="70" y1="52" x2="90" y2="52" />
        </g>

        {/* === Pommel (with gem) === */}
        <circle cx="58" cy="45" r="16" fill="url(#swGold)" stroke="#0d0a06" strokeWidth="2.5" />
        <circle cx="58" cy="45" r="16" fill="none" stroke="#fff6dc" strokeWidth="1" opacity="0.5" />
        {/* Ruby inset */}
        <g className="gem-glow">
          <circle cx="58" cy="45" r="8" fill="url(#swRuby)" stroke="#0d0a06" strokeWidth="1.5" />
          {/* Highlight shine on gem */}
          <ellipse cx="55" cy="42" rx="3" ry="1.8" fill="rgba(255,255,255,0.7)" />
        </g>

        {/* === Tip detail === */}
        <path d="M428 45 L432 45 L428 47 Z" fill="#fff" opacity="0.6" />
      </svg>

      {/* Meta row: duration + tier label */}
      {taskText && (
        <div className="flex items-center justify-between mt-1 px-4">
          <p className="font-display text-[12px] text-[var(--color-gold-100)] text-stroke-dark tracking-wider">
            {tierLabel ?? ''}
          </p>
          <p className="font-display text-[12px] text-[var(--color-gold-100)] text-stroke-dark tracking-wider">
            {durationMin ? `${durationMin} MIN` : ''}
          </p>
        </div>
      )}

      {!taskText && (
        <div className="text-center mt-1">
          <p className="font-display text-[13px] text-[var(--color-gold-100)] text-stroke-dark tracking-[0.2em] uppercase">
            Kies je opdracht
          </p>
        </div>
      )}
    </button>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
