'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTimeOfDay, type TimeOfDay } from '@/lib/timeOfDay';

// Hero scene — a looping Runway-generated medieval kingdom video as
// the background, with animated overlays on top:
//   - day/night colour tint that shifts with the Amsterdam clock
//   - dragon silhouette flying across on a long cycle
//   - streak flame above the castle if the user has an active streak
//   - stars that fade in at night
//   - falling leaves/embers
//
// The video handles the baked-in villagers, horses, banners, and
// castle itself. Everything else that moves is my overlay.

interface Props {
  className?: string;
}

export default function DashboardHero(_props: Props = {}) {
  const [tod, setTod] = useState<TimeOfDay>(() => getTimeOfDay());
  useEffect(() => {
    const id = window.setInterval(() => setTod(getTimeOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Night tint colour + opacity for mix-blend
  const nightTint = tod.darkness > 0.3;
  const duskTint = tod.phase === 'dusk';

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        // No hard border at the bottom — the scene fades into the
        // night background via a gradient overlay so the sword feels
        // like it sits inside the same world.
      }}
    >
      {/* === Background video (native loop — Runway already made a loop) ===
           Wrapped in a Link so tapping on the castle navigates to /stad.
           The sword + overlays above have higher z-index so they stay
           tappable. */}
      <Link
        href="/stad"
        aria-label="Naar je stad"
        className="absolute inset-0 z-0 active:brightness-110 transition-all"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <video
          src="/dashboard-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'cover',
            filter: 'saturate(1.08)',
          }}
        />
      </Link>

      {/* Hidden SVG defs used by overlay filters / gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="heroTorchFlame" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#fff8c0" />
            <stop offset="40%" stopColor="#ffcc3f" />
            <stop offset="80%" stopColor="#ff4a0e" />
            <stop offset="100%" stopColor="rgba(255, 80, 20, 0)" />
          </radialGradient>
        </defs>
      </svg>

      {/* === Day/night tint overlay — subtle, no multiply === */}
      {nightTint && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(12, 20, 50, 0.22) 0%, rgba(30, 10, 30, 0.12) 60%, rgba(0, 0, 0, 0.15) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {duskTint && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255, 120, 30, 0.08) 0%, rgba(200, 40, 30, 0.05) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}


      {/* === Drifting clouds overlay === */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="cloud-drift" style={{ position: 'absolute', top: '8%',  left: 0, width: 90, height: 18, borderRadius: 999, background: 'rgba(255,245,200,0.55)', boxShadow: '0 0 28px rgba(255,220,150,0.35)', animationDuration: '55s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '16%', left: 0, width: 70, height: 14, borderRadius: 999, background: 'rgba(255,245,200,0.45)', animationDuration: '70s', animationDelay: '-22s' }} />
      </div>

      {/* === Birds overlay === */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="bird-fly absolute" style={{ top: '14%', left: 0, width: '100%', height: 14, animationDuration: '28s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q5 0 10 8 Q15 0 20 8" fill="none" stroke="#0d0a06" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '22%', left: 0, width: '100%', height: 14, animationDuration: '34s', animationDelay: '-10s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q4 2 8 8 Q12 2 16 8" fill="none" stroke="#0d0a06" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* === Stars === */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: tod.darkness }}
      >
        {[
          { left: '10%', top: '4%',  size: 2 },
          { left: '24%', top: '9%',  size: 1.5 },
          { left: '38%', top: '3%',  size: 2 },
          { left: '52%', top: '10%', size: 2 },
          { left: '66%', top: '6%',  size: 3 },
          { left: '76%', top: '13%', size: 2 },
          { left: '88%', top: '2%',  size: 2 },
          { left: '6%',  top: '15%', size: 1.5 },
          { left: '45%', top: '18%', size: 1.5 },
          { left: '92%', top: '17%', size: 2 },
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
              opacity: 0.9,
              animation: 'softPulse 3s ease-in-out infinite',
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* === Falling leaves / embers === */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { left: '15%', color: '#c0392b', delay: '0s',   duration: '16s' },
          { left: '32%', color: '#ef7336', delay: '-5s',  duration: '18s' },
          { left: '50%', color: '#f0b840', delay: '-9s',  duration: '17s' },
          { left: '68%', color: '#c0392b', delay: '-2s',  duration: '20s' },
          { left: '84%', color: '#ef7336', delay: '-12s', duration: '16s' },
          { left: '42%', color: '#7a4f2a', delay: '-6s',  duration: '19s' },
        ].map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              top: '-6%',
              width: 5,
              height: 7,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: p.color,
              boxShadow: `0 0 4px ${p.color}`,
              animation: `leafFall ${p.duration} linear infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
