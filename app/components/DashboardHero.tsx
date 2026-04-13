'use client';

import { useEffect, useRef, useState } from 'react';
import { getTimeOfDay, type TimeOfDay } from '@/lib/timeOfDay';
import { useStreak } from '@/lib/useStreak';

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

  const streak = useStreak();
  const showStreakFlame = streak.current > 0;

  // Slow ping-pong loop: the video plays forward at 0.5x native speed,
  // when it ends we rAF-reverse it at the same slow rate, then flip
  // again at the start. Forward and reverse are symmetric so there's
  // no perceptible cut at either end.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const SLOW = 0.5;           // 50% speed
    let dir: 1 | -1 = 1;
    let raf = 0;
    let lastTs = 0;

    v.playbackRate = SLOW;

    const tick = (ts: number) => {
      if (!v) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (dir === -1) {
        const next = v.currentTime - dt * SLOW;
        if (next <= 0.02) {
          v.currentTime = 0;
          dir = 1;
          v.play().catch(() => {});
        } else {
          v.currentTime = next;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      dir = -1;
      v.pause();
      lastTs = 0;
    };

    v.addEventListener('ended', onEnded);
    v.play().catch(() => {});
    raf = requestAnimationFrame(tick);

    return () => {
      v.removeEventListener('ended', onEnded);
      if (raf) cancelAnimationFrame(raf);
    };
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
      {/* === Background video (ping-pong loop via JS) === */}
      <video
        ref={videoRef}
        src="/dashboard-hero.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: 'cover',
          filter: 'saturate(1.08)',
        }}
      />

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

      {/* === Day/night tint overlay === */}
      {nightTint && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(12, 14, 40, 0.65) 0%, rgba(40, 10, 20, 0.45) 55%, rgba(0, 0, 0, 0.55) 100%)',
            mixBlendMode: 'multiply',
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
              'linear-gradient(180deg, rgba(255, 120, 30, 0.15) 0%, rgba(200, 40, 30, 0.1) 100%)',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* === SVG overlays (dragon, streak flame) === */}
      <svg
        viewBox="0 0 420 320"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dragon silhouette flying across */}
        <g className="hero-svg-anim dragon-fly">
          <path
            d="M0 0 Q-8 -6 -14 -4 Q-18 0 -14 4 Q-10 6 -6 4 Q-2 8 2 4 Q8 8 14 4 Q18 0 14 -4 Q8 -6 2 -4 Q-2 0 -6 -4 Q-8 -2 -6 0 Q0 2 0 0 Z"
            fill="#0d0a06"
            opacity="0.7"
          />
        </g>

        {/* Streak flame above the castle — approximate centre top */}
        {showStreakFlame && (
          <g
            className="hero-svg-anim"
            style={{
              animation: 'torchFlicker 0.8s ease-in-out infinite',
              transform: 'translate(210px, 60px)',
            }}
          >
            <path
              d="M0 0 Q-10 -22 0 -34 Q-4 -16 8 -24 Q4 -4 14 -12 Q10 10 0 16 Q-14 10 -18 4 Q-14 -8 0 0 Z"
              fill="url(#heroTorchFlame)"
              stroke="#7a2e0a"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="0" cy="-10" r="4" fill="#fff8c0" opacity="0.9" />
            <text
              x="0"
              y="28"
              textAnchor="middle"
              fontFamily="Lilita One, sans-serif"
              fontSize="18"
              fill="#fdd069"
              stroke="#0d0a06"
              strokeWidth="1.8"
              paintOrder="stroke fill"
            >
              {streak.current}
            </text>
          </g>
        )}
      </svg>

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

      {/* === Smooth fade to the app background at the bottom === */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '28%',
          background:
            'linear-gradient(180deg, rgba(13, 10, 6, 0) 0%, rgba(13, 10, 6, 0.35) 40%, rgba(13, 10, 6, 0.85) 80%, rgba(13, 10, 6, 1) 100%)',
          pointerEvents: 'none',
        }}
      />

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
