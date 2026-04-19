'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DailyTask, TaskTier } from '@/lib/dailyTasks';

interface Props {
  tasks: DailyTask[];
  onPick: (task: DailyTask) => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

// Which tier gets the "Populair" ribbon (mirrors reference: 30min card)
const RIBBON_TIER: TaskTier = 'medium';

export default function BookPicker({ tasks, onPick }: Props) {
  // Sort so easy/medium/hard always render in that visual order
  const order: TaskTier[] = ['easy', 'medium', 'hard'];
  const sorted = [...tasks].sort(
    (a, b) => order.indexOf(a.tier) - order.indexOf(b.tier),
  );

  // Lock body scroll + mount-gate for portal (SSR-safe)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 grid place-items-center"
      onTouchMove={(e) => e.preventDefault()}
      style={{
        zIndex: 2147483647,
        padding: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="relative"
        style={{
          width: 'min(420px, 100%)',
          maxHeight: '100%',
          filter:
            'drop-shadow(0 20px 30px rgba(0,0,0,.55)) drop-shadow(0 6px 10px rgba(0,0,0,.5))',
          animation: 'bookPickerPop .45s cubic-bezier(.2,1.4,.3,1) both',
        }}
      >
        {/* wood frame */}
        <div
          className="relative"
          style={{
            padding: '16px 14px 14px',
            borderRadius: 20,
            background:
              'repeating-linear-gradient(92deg, rgba(0,0,0,0) 0px, rgba(0,0,0,.08) 2px, rgba(0,0,0,0) 5px, rgba(255,220,170,.04) 7px, rgba(0,0,0,.06) 10px), ' +
              'radial-gradient(80px 20px at 15% 8%,  rgba(0,0,0,.35), rgba(0,0,0,0) 70%), ' +
              'radial-gradient(120px 24px at 80% 12%, rgba(0,0,0,.30), rgba(0,0,0,0) 70%), ' +
              'radial-gradient(100px 22px at 30% 92%, rgba(0,0,0,.35), rgba(0,0,0,0) 70%), ' +
              'radial-gradient(140px 26px at 85% 88%, rgba(0,0,0,.30), rgba(0,0,0,0) 70%), ' +
              'linear-gradient(180deg, #6a3a1c 0%, #4a2410 40%, #3a1c0a 70%, #2a1204 100%)',
            boxShadow:
              'inset 0 0 0 2px #1a0a03, inset 0 0 0 3px rgba(255,180,100,.15), inset 0 2px 0 rgba(255,210,150,.22), inset 0 -3px 0 rgba(0,0,0,.55), inset 4px 4px 10px rgba(255,200,140,.08), inset -4px -4px 14px rgba(0,0,0,.55)',
          }}
        >
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />

          {/* parchment inner */}
          <div
            className="relative"
            style={{
              borderRadius: 12,
              padding: '12px 12px 14px',
              background:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\"), " +
                'radial-gradient(120% 80% at 50% 0%, #f5e4bd 0%, #e9d19c 45%, #d4b578 100%)',
              boxShadow:
                'inset 0 2px 0 rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.3), inset 0 -2px 0 rgba(255,240,200,.35), 0 1px 0 rgba(255,220,170,.3)',
            }}
          >
            {/* header */}
            <div className="text-center" style={{ padding: '0 4px 8px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: cinzel,
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.28em',
                  color: '#5a3a22',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                <span style={sep} />
                <span style={diamond} />
                Vandaag
                <span style={diamond} />
                <span style={sep} />
              </div>
              <h1
                style={{
                  fontFamily: cinzel,
                  fontWeight: 900,
                  fontSize: 'clamp(22px, 6vw, 28px)',
                  lineHeight: 1.05,
                  margin: '0 0 4px',
                  color: '#2a1608',
                  textShadow:
                    '0 1px 0 rgba(255,240,200,.45), 0 2px 0 rgba(255,240,200,.2)',
                  letterSpacing: '0.01em',
                }}
              >
                Kies je Opdracht
              </h1>
              <div
                style={{
                  fontFamily: philosopher,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: '#5a3a22',
                  opacity: 0.85,
                }}
              >
                Voltooi een opdracht om coins te verdienen
              </div>
            </div>

            {/* cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((task) => (
                <MissionCard
                  key={task.id}
                  task={task}
                  showRibbon={task.tier === RIBBON_TIER}
                  onPick={() => onPick(task)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bookPickerPop {
          0% {
            transform: scale(0.85) translateY(12px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ---------- subcomponents ---------- */

function MissionCard({
  task,
  showRibbon,
  onPick,
}: {
  task: DailyTask;
  showRibbon: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="group"
      style={{
        position: 'relative',
        border: 'none',
        padding: '12px 10px 12px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        color: '#3a2312',
        display: 'grid',
        gridTemplateColumns: '44px 1fr auto',
        alignItems: 'center',
        gap: 10,
        background:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='n'><feTurbulence baseFrequency='1.1' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .18  0 0 0 0 .08  0 0 0 .14 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\"), " +
          'linear-gradient(180deg, #fbecc4 0%, #eed49b 55%, #dfbf80 100%)',
        boxShadow:
          '0 1px 0 rgba(255,240,200,.6), inset 0 0 0 1px rgba(90,60,28,.55), inset 0 0 0 2px rgba(255,240,200,.25), inset 0 2px 2px rgba(255,255,230,.5), inset 0 -3px 4px rgba(120,80,30,.25), 0 3px 0 rgba(0,0,0,.35), 0 6px 10px rgba(0,0,0,.3)',
        transition: 'transform .12s ease, filter .12s ease',
        fontFamily: 'inherit',
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(2px)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
      }}
    >
      {showRibbon && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: 16,
            fontFamily: cinzel,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: '#fff6d8',
            padding: '4px 12px 5px',
            background: 'linear-gradient(180deg, #9a2718 0%, #6a1608 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,200,180,.5), inset 0 -1px 0 rgba(0,0,0,.4), 0 2px 3px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.35)',
            clipPath:
              'polygon(0 0, 100% 0, 100% 100%, 90% 70%, 10% 70%, 0 100%)',
            textShadow: '0 1px 0 rgba(0,0,0,.4)',
            zIndex: 3,
          }}
        >
          Populair
        </div>
      )}

      <div style={iconTile}>
        <TierIcon tier={task.tier} />
      </div>

      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: philosopher,
            fontWeight: 700,
            fontSize: 13.5,
            color: '#2a1608',
            lineHeight: 1.3,
            margin: 0,
            textShadow: '0 1px 0 rgba(255,240,200,.5)',
            wordBreak: 'break-word',
          }}
        >
          {task.text}
        </p>
        <div
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(58,35,18,.1)',
            boxShadow: 'inset 0 0 0 1px rgba(58,35,18,.3)',
            fontFamily: cinzel,
            fontWeight: 700,
            fontSize: 11,
            color: '#3a2312',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ ...coinDot, width: 10, height: 10 }} />
          {task.coins}
        </div>
      </div>

      <div style={goldBadge} aria-label={`${task.durationMin} minuten`}>
        <ClockIcon />
        <span style={{ fontWeight: 900, fontSize: 14 }}>
          {task.durationMin} min
        </span>
      </div>
    </button>
  );
}

function TierIcon({ tier }: { tier: TaskTier }) {
  if (tier === 'easy') {
    return (
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <path
          d="M4 7 Q10 5 16 8 Q22 5 28 7 L28 25 Q22 23 16 26 Q10 23 4 25 Z"
          fill="#e6cf9a"
          stroke="#3a2108"
          strokeWidth="1.2"
        />
        <path d="M16 8 L16 26" stroke="#3a2108" strokeWidth="1.2" />
        <path
          d="M7 11 L13 12 M7 14 L13 15 M7 17 L13 18"
          stroke="#8a6a3b"
          strokeWidth=".8"
        />
        <path
          d="M19 12 L25 11 M19 15 L25 14 M19 18 L25 17"
          stroke="#8a6a3b"
          strokeWidth=".8"
        />
        <path
          d="M22 5 L22 14 L23.5 12.5 L25 14 L25 5"
          fill="#8a2a1a"
          stroke="#3a2108"
          strokeWidth=".8"
        />
      </svg>
    );
  }
  if (tier === 'medium') {
    return (
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <path
          d="M16 3 L18 21 L16 23 L14 21 Z"
          fill="#d9d9d9"
          stroke="#2a1608"
          strokeWidth="1"
        />
        <rect
          x="13"
          y="21"
          width="6"
          height="2.2"
          fill="#8a5a22"
          stroke="#2a1608"
          strokeWidth="1"
        />
        <rect
          x="15"
          y="23"
          width="2"
          height="5"
          fill="#4a2410"
          stroke="#2a1608"
          strokeWidth="1"
        />
        <circle
          cx="16"
          cy="28.5"
          r="1.4"
          fill="#d8a233"
          stroke="#2a1608"
          strokeWidth=".8"
        />
        <rect x="5" y="15" width="4" height="2" rx=".5" fill="#2a1608" />
        <rect x="6" y="13" width="2" height="6" rx=".5" fill="#2a1608" />
        <rect x="23" y="15" width="4" height="2" rx=".5" fill="#2a1608" />
        <rect x="24" y="13" width="2" height="6" rx=".5" fill="#2a1608" />
        <rect x="8" y="15.5" width="16" height="1.2" fill="#2a1608" />
      </svg>
    );
  }
  // hard
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <path
        d="M6 7 Q6 4 9 4 L23 4 Q26 4 26 7 L26 25 Q26 28 23 28 L9 28 Q6 28 6 25 Z"
        fill="#f0dcaa"
        stroke="#2a1608"
        strokeWidth="1.2"
      />
      <path
        d="M6 7 Q6 9 9 9 Q12 9 12 7"
        fill="none"
        stroke="#2a1608"
        strokeWidth="1"
      />
      <path
        d="M26 25 Q26 23 23 23 Q20 23 20 25"
        fill="none"
        stroke="#2a1608"
        strokeWidth="1"
      />
      <path
        d="M10 14 L20 14 M10 17 L22 17 M10 20 L18 20"
        stroke="#8a6a3b"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M23 10 L28 4 L27 9 Z"
        fill="#8a2a1a"
        stroke="#2a1608"
        strokeWidth=".8"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle
        cx="8"
        cy="8.5"
        r="6"
        stroke="#4a2a08"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M8 5 L8 8.5 L10.5 10"
        stroke="#4a2a08"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6 2 L10 2"
        stroke="#4a2a08"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 46,
    height: 46,
    zIndex: 2,
    pointerEvents: 'none',
  };
  const style: React.CSSProperties = { ...base };
  if (pos === 'tl') Object.assign(style, { top: 6, left: 6 });
  if (pos === 'tr')
    Object.assign(style, { top: 6, right: 6, transform: 'scaleX(-1)' });
  if (pos === 'bl')
    Object.assign(style, { bottom: 6, left: 6, transform: 'scaleY(-1)' });
  if (pos === 'br')
    Object.assign(style, { bottom: 6, right: 6, transform: 'scale(-1,-1)' });

  return (
    <svg style={style} viewBox="0 0 46 46" aria-hidden>
      <defs>
        <linearGradient id={`bpg-${pos}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe58a" />
          <stop offset=".5" stopColor="#c98c1a" />
          <stop offset="1" stopColor="#6a3a0a" />
        </linearGradient>
      </defs>
      <path
        d="M2 2 H28 Q28 14 20 20 Q14 28 2 28 Z"
        fill="#1a0a03"
        stroke="#000"
        strokeWidth="1"
      />
      <path
        d="M5 5 H24 Q24 10 19 15 Q14 20 5 20 Z"
        fill={`url(#bpg-${pos})`}
        stroke="#4a2a08"
        strokeWidth=".8"
      />
      <path
        d="M9 9 H20 Q20 13 16 15 Q13 17 9 17"
        fill="none"
        stroke="#4a2a08"
        strokeWidth=".8"
      />
      <circle
        cx="7.5"
        cy="7.5"
        r="2"
        fill={`url(#bpg-${pos})`}
        stroke="#2a1608"
        strokeWidth=".6"
      />
      <circle cx="7.5" cy="7" r=".6" fill="#fff6d0" />
    </svg>
  );
}

/* ---------- reusable style tokens ---------- */

const sep: React.CSSProperties = {
  width: 28,
  height: 1,
  background:
    'linear-gradient(90deg, transparent, #8a6a3b, transparent)',
};
const diamond: React.CSSProperties = {
  width: 6,
  height: 6,
  background: '#8e5a18',
  transform: 'rotate(45deg)',
  boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
};
const iconTile: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background:
    'radial-gradient(circle at 30% 30%, rgba(255,220,170,.12), transparent 60%), ' +
    'linear-gradient(180deg, #3a1f0e, #1c0e05)',
  boxShadow:
    'inset 0 0 0 1px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,200,140,.15), inset 0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,240,200,.5)',
  color: '#ffe58a',
};
const goldBadge: React.CSSProperties = {
  position: 'relative',
  minWidth: 60,
  padding: '8px 10px 9px',
  borderRadius: 999,
  fontFamily: cinzel,
  fontWeight: 800,
  fontSize: 14,
  color: '#3a2108',
  textAlign: 'center',
  letterSpacing: '0.02em',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  background:
    'radial-gradient(ellipse 70% 40% at 50% 15%, rgba(255,250,210,.85), rgba(255,250,210,0) 70%), ' +
    'radial-gradient(circle at 20% 30%, rgba(0,0,0,.18) 0 2px, transparent 3px), ' +
    'radial-gradient(circle at 75% 25%, rgba(0,0,0,.15) 0 2px, transparent 3px), ' +
    'radial-gradient(circle at 40% 70%, rgba(0,0,0,.18) 0 2px, transparent 3px), ' +
    'radial-gradient(circle at 82% 75%, rgba(0,0,0,.15) 0 2px, transparent 3px), ' +
    'radial-gradient(circle at 55% 50%, rgba(255,255,220,.25) 0 2px, transparent 3px), ' +
    'linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
  boxShadow:
    'inset 0 0 0 1.5px #4a2a08, inset 0 0 0 2.5px rgba(255,240,150,.5), inset 0 2px 0 rgba(255,255,220,.55), inset 0 -2px 0 rgba(90,50,10,.55), 0 2px 0 rgba(0,0,0,.5), 0 4px 8px rgba(0,0,0,.35)',
  textShadow: '0 1px 0 rgba(255,240,180,.6)',
};
const coinDot: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 30% 30%, #ffe07a, #c98c1a 60%, #7a4a0a 100%)',
  boxShadow:
    'inset 0 -1px 0 rgba(0,0,0,.4), 0 0 0 1px rgba(58,20,4,.7)',
  flex: 'none',
  display: 'inline-block',
};

