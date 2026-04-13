'use client';

import { useEffect, useState } from 'react';
import { getTimeOfDay, type TimeOfDay } from '@/lib/timeOfDay';
import { useStreak } from '@/lib/useStreak';

// Dense hand-drawn SVG hero scene — medieval kingdom with a live
// day/night cycle. Sky colours shift with the real Amsterdam clock.
// A dragon flies across on a long timer. Windows glow stronger at
// night. If the user has a streak, a flame hovers above the keep.

interface Props {
  className?: string;
}

export default function DashboardHero(_props: Props = {}) {
  // Recompute every 60s so the sky shifts over time
  const [tod, setTod] = useState<TimeOfDay>(() => getTimeOfDay());
  useEffect(() => {
    const id = window.setInterval(() => setTod(getTimeOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  const streak = useStreak();
  const showStreakFlame = streak.current > 0;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: '390 / 460',
        borderBottom: '3px solid #0d0a06',
        boxShadow:
          'inset 0 -20px 40px -8px rgba(0, 0, 0, 0.65)',
      }}
    >
      <svg
        viewBox="0 0 390 460"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* === GRADIENTS === */}
          {/* Sky gradient is dynamic: colour stops come from time-of-day */}
          <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={tod.skyTop} />
            <stop offset="28%" stopColor={tod.skyMid} />
            <stop offset="60%" stopColor={tod.skyLow} />
            <stop offset="100%" stopColor={tod.skyBottom} />
          </linearGradient>
          <radialGradient id="heroSun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"  stopColor="#fff8e0" />
            <stop offset="25%" stopColor="#ffe591" />
            <stop offset="65%" stopColor="#ff9a3a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgba(255, 150, 60, 0)" />
          </radialGradient>
          <linearGradient id="farMount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a2a18" />
            <stop offset="100%" stopColor="#4a140a" />
          </linearGradient>
          <linearGradient id="nearMount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a1208" />
            <stop offset="100%" stopColor="#1a0604" />
          </linearGradient>
          <linearGradient id="stoneLight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c68e52" />
            <stop offset="50%" stopColor="#9b6838" />
            <stop offset="100%" stopColor="#5c3a1e" />
          </linearGradient>
          <linearGradient id="stoneDark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a4f2a" />
            <stop offset="50%" stopColor="#5c3a1e" />
            <stop offset="100%" stopColor="#2a1a0a" />
          </linearGradient>
          <linearGradient id="roofRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f58060" />
            <stop offset="50%" stopColor="#c0392b" />
            <stop offset="100%" stopColor="#4a0800" />
          </linearGradient>
          <linearGradient id="roofShadow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a3718" />
            <stop offset="50%" stopColor="#2a1a0a" />
            <stop offset="100%" stopColor="#0d0a06" />
          </linearGradient>
          <linearGradient id="knightArmor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ececec" />
            <stop offset="50%" stopColor="#8c8c8c" />
            <stop offset="100%" stopColor="#262626" />
          </linearGradient>
          <linearGradient id="knightShield" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f04a28" />
            <stop offset="100%" stopColor="#6e1608" />
          </linearGradient>
          <radialGradient id="windowGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff0a0" />
            <stop offset="60%" stopColor="#ff9432" />
            <stop offset="100%" stopColor="rgba(255, 120, 30, 0)" />
          </radialGradient>
          <radialGradient id="torchFlame" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#fff8c0" />
            <stop offset="40%" stopColor="#ffcc3f" />
            <stop offset="80%" stopColor="#ff4a0e" />
            <stop offset="100%" stopColor="rgba(255, 80, 20, 0)" />
          </radialGradient>

          {/* Subtle noise for textures */}
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.1 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width="390" height="460" fill="url(#heroSky)" />

        {/* Sun halo + disc — positioned behind the central keep, pulses.
            Only renders during day/dawn/dusk. */}
        {tod.sunVisible && (
          <g style={{ animation: 'sunPulse 4s ease-in-out infinite', opacity: Math.max(0.4, tod.daylight) }}>
            <circle cx="300" cy="120" r="130" fill="url(#heroSun)" />
            <circle cx="300" cy="120" r="42" fill="#fff6dc" opacity="0.98" />
            <circle cx="300" cy="120" r="32" fill="#ffdb7c" />
          </g>
        )}

        {/* Moon — night only, with craters */}
        {tod.moonVisible && (
          <g style={{ opacity: Math.max(0.4, tod.darkness) }}>
            <circle cx="300" cy="100" r="90" fill="rgba(200, 210, 240, 0.15)" />
            <circle cx="300" cy="100" r="40" fill="#e8e8f0" />
            <circle cx="300" cy="100" r="36" fill="#f0f0f8" />
            <circle cx="288" cy="92"  r="4" fill="#c8c8d0" opacity="0.6" />
            <circle cx="310" cy="108" r="5" fill="#c8c8d0" opacity="0.5" />
            <circle cx="302" cy="90"  r="3" fill="#c8c8d0" opacity="0.55" />
          </g>
        )}

        {/* Dragon silhouette flying in the distance — starts from left,
            crosses the sky every ~45s */}
        <g className="hero-svg-anim dragon-fly">
          <path
            d="M0 0 Q-8 -6 -14 -4 Q-18 0 -14 4 Q-10 6 -6 4 Q-2 8 2 4 Q8 8 14 4 Q18 0 14 -4 Q8 -6 2 -4 Q-2 0 -6 -4 Q-8 -2 -6 0 Q0 2 0 0 Z"
            fill="#0d0a06"
            opacity="0.75"
          />
          <path d="M-2 1 L-4 3 L-1 2 Z" fill="#0d0a06" opacity="0.6" />
        </g>

        {/* Everything from mountains onward is shifted down so the castle
            sits in the lower portion of a 460-tall viewBox, with lots of
            open sky above for banners to hang into. */}
        <g transform="translate(0, 140)">

        {/* Far mountains — jagged silhouette */}
        <path
          d="M0 178
             L30 150 L60 175 L95 132 L130 170 L170 140 L210 172 L250 142 L290 175
             L330 150 L380 180 L390 165 L390 220 L0 220 Z"
          fill="url(#farMount)"
          stroke="#1a0604"
          strokeWidth="2"
          opacity="0.92"
        />

        {/* Near mountains */}
        <path
          d="M0 215 L40 198 L85 218 L130 192 L175 215 L220 195 L270 220 L320 200 L370 222 L390 210 L390 260 L0 260 Z"
          fill="url(#nearMount)"
          stroke="#0d0a06"
          strokeWidth="2"
        />

        {/* === CASTLE === */}

        {/* Back wall behind keep */}
        <rect x="80" y="180" width="230" height="70" fill="url(#stoneDark)" stroke="#0d0a06" strokeWidth="3" />
        {/* Crenellations on back wall */}
        <g fill="url(#stoneDark)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(11)].map((_, i) => (
            <rect key={i} x={82 + i * 22} y="170" width="14" height="12" />
          ))}
        </g>
        {/* Brick lines */}
        <g stroke="#0d0a06" strokeWidth="1.2" opacity="0.55">
          <line x1="80" y1="200" x2="310" y2="200" />
          <line x1="80" y1="218" x2="310" y2="218" />
          <line x1="80" y1="236" x2="310" y2="236" />
          {[...Array(6)].map((_, row) =>
            [...Array(11)].map((_, col) => {
              const offset = row % 2 === 0 ? 0 : 10;
              const x = 90 + col * 20 + offset;
              const y = 180 + row * 12;
              if (x > 300 || y > 246) return null;
              return <line key={`${row}-${col}`} x1={x} y1={y} x2={x} y2={y + 12} />;
            }),
          )}
        </g>

        {/* === LEFT TOWER === */}
        <rect x="60" y="122" width="54" height="138" fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="3" />
        <rect x="100" y="122" width="14" height="138" fill="url(#roofShadow)" />
        {/* Tower crenellations */}
        <g fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(4)].map((_, i) => (
            <rect key={i} x={62 + i * 13} y="112" width="9" height="12" />
          ))}
        </g>
        {/* Window with night glow */}
        <path d="M82 150 Q82 142 87 142 Q92 142 92 150 L92 164 L82 164 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="87" cy="150" r="6" fill="url(#windowGlow)" opacity={0.6 + tod.darkness * 0.4} style={{ animation: 'windowFlicker 2.4s ease-in-out infinite' }} />
        {tod.darkness > 0.3 && <circle cx="87" cy="150" r="12" fill="#ffb866" opacity={tod.darkness * 0.2} filter="url(#grain)" />}
        {/* Conical roof */}
        <polygon points="52,122 87,72 122,122" fill="url(#roofRed)" stroke="#0d0a06" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="87,72 122,122 87,112" fill="rgba(0,0,0,0.35)" />
        {/* Roof bands */}
        <line x1="69" y1="96" x2="105" y2="96" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="61" y1="116" x2="113" y2="116" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        {/* Flag — the inner wrapper has the animation with transform-box
            set via .hero-svg-anim; origin is the flag's own left edge */}
        <line x1="87" y1="72" x2="87" y2="46" stroke="#0d0a06" strokeWidth="2" />
        <g className="hero-svg-anim" style={{ transformOrigin: 'left center', animation: 'flagWave 2.4s ease-in-out infinite' }}>
          <path d="M87 48 L106 54 L87 62 Z" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.5" />
        </g>

        {/* === RIGHT TOWER === */}
        <rect x="276" y="122" width="54" height="138" fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="3" />
        <rect x="316" y="122" width="14" height="138" fill="url(#roofShadow)" />
        <g fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(4)].map((_, i) => (
            <rect key={i} x={278 + i * 13} y="112" width="9" height="12" />
          ))}
        </g>
        <path d="M298 150 Q298 142 303 142 Q308 142 308 150 L308 164 L298 164 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="303" cy="150" r="6" fill="url(#windowGlow)" opacity={0.6 + tod.darkness * 0.4} style={{ animation: 'windowFlicker 2.8s ease-in-out infinite' }} />
        <polygon points="268,122 303,72 338,122" fill="url(#roofRed)" stroke="#0d0a06" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="303,72 338,122 303,112" fill="rgba(0,0,0,0.35)" />
        <line x1="285" y1="96" x2="321" y2="96" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="277" y1="116" x2="329" y2="116" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="303" y1="72" x2="303" y2="46" stroke="#0d0a06" strokeWidth="2" />
        <g className="hero-svg-anim" style={{ transformOrigin: 'left center', animation: 'flagWave 2.4s ease-in-out infinite', animationDelay: '-0.6s' }}>
          <path d="M303 48 L322 54 L303 62 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="1.5" />
        </g>

        {/* === MAIN KEEP === */}
        <rect x="160" y="88" width="70" height="172" fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="3" />
        <rect x="215" y="88" width="15" height="172" fill="url(#roofShadow)" />
        {/* Keep crenellations */}
        <g fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(5)].map((_, i) => (
            <rect key={i} x={162 + i * 14} y="78" width="10" height="12" />
          ))}
        </g>
        {/* Keep window (upper) with night bloom */}
        <path d="M180 114 Q180 105 190 105 Q200 105 200 114 L200 132 L180 132 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="190" cy="116" r="8" fill="url(#windowGlow)" opacity={0.7 + tod.darkness * 0.3} style={{ animation: 'windowFlicker 2.6s ease-in-out infinite' }} />
        {tod.darkness > 0.3 && <circle cx="190" cy="116" r="18" fill="#ffb866" opacity={tod.darkness * 0.25} />}
        {/* Keep window (middle) */}
        <path d="M205 148 Q205 141 210 141 Q215 141 215 148 L215 160 L205 160 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="210" cy="150" r="4" fill="url(#windowGlow)" opacity={0.6 + tod.darkness * 0.4} style={{ animation: 'windowFlicker 2.2s ease-in-out infinite' }} />
        {/* Keep gate (arched) */}
        <path
          d="M180 260 L180 210 Q180 192 195 192 Q210 192 210 210 L210 260 Z"
          fill="#0d0a06"
          stroke="#0d0a06"
          strokeWidth="3"
        />
        {/* Gate bars */}
        <g stroke="#3a2a18" strokeWidth="1.5" opacity="0.8">
          <line x1="188" y1="208" x2="188" y2="258" />
          <line x1="195" y1="198" x2="195" y2="258" />
          <line x1="202" y1="208" x2="202" y2="258" />
        </g>
        {/* Gate torches — flicker. Each torch flame is wrapped in a
            hero-svg-anim group so transform-origin is its own center. */}
        <g className="hero-svg-anim" style={{ animation: 'torchFlicker 0.7s ease-in-out infinite' }}>
          <circle cx="172" cy="210" r="10" fill="url(#torchFlame)" />
          <circle cx="172" cy="207" r="5" fill="#fff2a0" opacity="0.9" />
        </g>
        <rect x="170" y="210" width="4" height="10" fill="#3a1208" stroke="#0d0a06" strokeWidth="1" />
        <g className="hero-svg-anim" style={{ animation: 'torchFlicker 0.7s ease-in-out infinite', animationDelay: '-0.35s' }}>
          <circle cx="218" cy="210" r="10" fill="url(#torchFlame)" />
          <circle cx="218" cy="207" r="5" fill="#fff2a0" opacity="0.9" />
        </g>
        <rect x="216" y="210" width="4" height="10" fill="#3a1208" stroke="#0d0a06" strokeWidth="1" />
        {/* Stone brick lines on keep */}
        <g stroke="#0d0a06" strokeWidth="1.2" opacity="0.6">
          <line x1="160" y1="108" x2="230" y2="108" />
          <line x1="160" y1="126" x2="230" y2="126" />
          <line x1="160" y1="144" x2="230" y2="144" />
          <line x1="160" y1="162" x2="230" y2="162" />
          <line x1="160" y1="180" x2="230" y2="180" />
          <line x1="160" y1="198" x2="230" y2="198" />
        </g>

        {/* Keep spire */}
        <polygon points="155,88 195,30 235,88" fill="url(#roofRed)" stroke="#0d0a06" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="195,30 235,88 195,78" fill="rgba(0,0,0,0.35)" />
        <line x1="155" y1="88" x2="235" y2="88" stroke="#0d0a06" strokeWidth="1.5" />
        <line x1="170" y1="66" x2="220" y2="66" stroke="#0d0a06" strokeWidth="1.5" opacity="0.55" />

        {/* Golden banner + flagpole on keep */}
        <line x1="195" y1="30" x2="195" y2="6" stroke="#0d0a06" strokeWidth="2.5" />
        <g className="hero-svg-anim" style={{ transformOrigin: 'left center', animation: 'flagWave 2s ease-in-out infinite', animationDelay: '-1.2s' }}>
          <path d="M195 8 L220 14 L195 22 Z" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.5" />
        </g>
        <circle cx="195" cy="6" r="2.5" fill="#f0b840" stroke="#0d0a06" strokeWidth="1" />

        {/* Streak flame above keep — only when streak is active */}
        {showStreakFlame && (
          <g className="hero-svg-anim" style={{ animation: 'torchFlicker 0.8s ease-in-out infinite' }}>
            <path
              d="M160 26 Q154 10 162 2 Q158 14 166 6 Q164 20 170 10 Q168 24 172 16 Q178 26 160 32 Z"
              fill="url(#torchFlame)"
              stroke="#7a2e0a"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="162" cy="18" r="4" fill="#fff8c0" opacity="0.9" />
            <text
              x="165"
              y="44"
              textAnchor="middle"
              fontFamily="Lilita One, sans-serif"
              fontSize="14"
              fill="#fdd069"
              stroke="#0d0a06"
              strokeWidth="1.4"
              paintOrder="stroke fill"
            >
              {streak.current}
            </text>
          </g>
        )}

        {/* Smoke from keep top — rising puffs. transform-box so the
            puffs translate/scale around their own center. */}
        <g className="hero-svg-anim" style={{ animation: 'smokeRise 3.2s ease-out infinite' }}>
          <circle cx="172" cy="60" r="4" fill="#eee" opacity="0.55" />
        </g>
        <g className="hero-svg-anim" style={{ animation: 'smokeRise 3.2s ease-out infinite', animationDelay: '-1s' }}>
          <circle cx="178" cy="54" r="5" fill="#eee" opacity="0.5" />
        </g>
        <g className="hero-svg-anim" style={{ animation: 'smokeRise 3.2s ease-out infinite', animationDelay: '-2s' }}>
          <circle cx="184" cy="48" r="4" fill="#eee" opacity="0.45" />
        </g>

        {/* Ground + grass */}
        <rect x="0" y="250" width="390" height="70" fill="url(#ground)" />
        <path d="M0 252 Q90 246 185 252 Q280 258 390 248 L390 255 L0 255 Z" fill="#1a0f05" opacity="0.5" />
        {[...Array(28)].map((_, i) => (
          <line
            key={i}
            x1={8 + i * 14}
            y1="250"
            x2={8 + i * 14 + ((i % 2) ? 2 : -2)}
            y2="244"
            stroke="#3a5a1a"
            strokeWidth="1.5"
            opacity="0.75"
          />
        ))}

        {/* === KNIGHT (big, foreground) — walks + bobs === */}
        <g transform="translate(56 266)">
         <g className="hero-svg-anim" style={{ animation: 'npcWalk1 9s ease-in-out infinite' }}>
          <g transform="scale(1.55)">
           <g className="hero-svg-anim" style={{ animation: 'npcBob 1.2s ease-in-out infinite' }}>
          {/* Cape behind */}
          <path d="M-6 -30 L6 -30 L14 -2 L0 6 L-14 -2 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          {/* Legs */}
          <rect x="-6" y="-6" width="5" height="12" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="2" />
          <rect x="1" y="-6" width="5" height="12" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="2" />
          {/* Boots */}
          <rect x="-7" y="4" width="7" height="4" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1.5" />
          <rect x="0" y="4" width="7" height="4" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1.5" />
          {/* Torso (breastplate with V-curve) */}
          <path d="M-10 -26 L10 -26 L12 -8 L-12 -8 Z" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M-6 -26 L0 -18 L6 -26" fill="none" stroke="#0d0a06" strokeWidth="1.5" opacity="0.8" />
          <line x1="0" y1="-18" x2="0" y2="-8" stroke="#0d0a06" strokeWidth="1.5" opacity="0.7" />
          {/* Shield (held in left hand) */}
          <path d="M-20 -22 L-8 -25 L-6 -4 L-14 4 L-22 -4 Z" fill="url(#knightShield)" stroke="#0d0a06" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M-18 -20 L-10 -22 L-9 -6 L-14 2 L-20 -6 Z" fill="none" stroke="#f0b840" strokeWidth="1.5" />
          <path d="M-14 -18 L-14 -4 M-18 -12 L-10 -12" stroke="#f0b840" strokeWidth="1.8" />
          {/* Sword (held in right hand, raised) */}
          <line x1="10" y1="-22" x2="18" y2="-42" stroke="#cccccc" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="10" y1="-22" x2="18" y2="-42" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
          <line x1="7" y1="-20" x2="13" y2="-24" stroke="#f0b840" strokeWidth="2" strokeLinecap="round" />
          {/* Head + helm */}
          <rect x="-7" y="-40" width="14" height="16" rx="2" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="2.5" />
          <rect x="-4" y="-33" width="8" height="2.5" fill="#0d0a06" />
          {/* Helmet plume */}
          <path d="M-3 -40 Q-5 -48 0 -46 Q5 -48 3 -40 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="1.5" />
          <path d="M0 -46 L0 -40" stroke="#0d0a06" strokeWidth="1.5" opacity="0.8" />
           </g>
          </g>
         </g>
        </g>

        {/* === PEASANT (right side of castle) — walks + bobs === */}
        <g transform="translate(330 264)">
         <g className="hero-svg-anim" style={{ animation: 'npcWalk2 7s ease-in-out infinite', animationDelay: '-2s' }}>
          <g transform="scale(1.2)">
           <g className="hero-svg-anim" style={{ animation: 'npcBob 1s ease-in-out infinite', animationDelay: '-0.4s' }}>
          {/* Legs */}
          <rect x="-4" y="-6" width="4" height="12" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1.5" />
          <rect x="0" y="-6" width="4" height="12" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1.5" />
          {/* Boots */}
          <rect x="-5" y="4" width="5" height="4" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
          <rect x="0" y="4" width="5" height="4" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
          {/* Tunic */}
          <path d="M-8 -22 L8 -22 L10 -6 L-10 -6 Z" fill="#7a4f2a" stroke="#0d0a06" strokeWidth="2" />
          {/* Belt */}
          <rect x="-10" y="-10" width="20" height="3" fill="#1a0f05" />
          <rect x="-1.5" y="-10" width="3" height="3" fill="#f0b840" />
          {/* Head */}
          <rect x="-5" y="-34" width="10" height="12" rx="1" fill="#e0b088" stroke="#0d0a06" strokeWidth="1.5" />
          {/* Hat */}
          <path d="M-6 -34 L6 -34 L4 -40 L-4 -40 Z" fill="#7a1e0a" stroke="#0d0a06" strokeWidth="1.5" />
          <rect x="-7" y="-34" width="14" height="2" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1" />
          {/* Pitchfork in hand */}
          <line x1="9" y1="-25" x2="14" y2="-44" stroke="#5c3a1e" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="-42" x2="11" y2="-48" stroke="#5c3a1e" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="-44" x2="14" y2="-50" stroke="#5c3a1e" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="-42" x2="17" y2="-48" stroke="#5c3a1e" strokeWidth="1.5" strokeLinecap="round" />
           </g>
          </g>
         </g>
        </g>

        {/* === ARCHER (center-left, patrols widely) === */}
        <g transform="translate(170 268)">
         <g className="hero-svg-anim" style={{ animation: 'npcWalk3 11s ease-in-out infinite' }}>
          <g transform="scale(1.05)">
           <g className="hero-svg-anim" style={{ animation: 'npcBob 1.1s ease-in-out infinite', animationDelay: '-0.2s' }}>
            {/* Legs */}
            <rect x="-3" y="-6" width="3" height="10" fill="#3a5a3a" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="0" y="-6" width="3" height="10" fill="#3a5a3a" stroke="#0d0a06" strokeWidth="1.4" />
            {/* Boots */}
            <rect x="-4" y="2" width="4" height="3" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
            <rect x="0" y="2" width="4" height="3" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
            {/* Leather tunic */}
            <path d="M-7 -20 L7 -20 L8 -6 L-8 -6 Z" fill="#5a7a3a" stroke="#0d0a06" strokeWidth="1.8" />
            <path d="M-7 -14 L7 -14" stroke="#0d0a06" strokeWidth="0.9" opacity="0.6" />
            {/* Bow */}
            <path d="M-12 -22 Q-18 -12 -12 -2" fill="none" stroke="#7a4f2a" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="-12" y1="-22" x2="-12" y2="-2" stroke="#fff" strokeWidth="0.6" />
            {/* Head */}
            <rect x="-4" y="-30" width="8" height="10" rx="1" fill="#c8a078" stroke="#0d0a06" strokeWidth="1.3" />
            {/* Hood */}
            <path d="M-5 -30 L5 -30 L5 -34 Q0 -38 -5 -34 Z" fill="#3a5a3a" stroke="#0d0a06" strokeWidth="1.4" />
           </g>
          </g>
         </g>
        </g>

        {/* === MERCHANT (left-of-castle, small patrol) === */}
        <g transform="translate(100 264)">
         <g className="hero-svg-anim" style={{ animation: 'npcWalk4 13s ease-in-out infinite', animationDelay: '-5s' }}>
          <g transform="scale(1.15)">
           <g className="hero-svg-anim" style={{ animation: 'npcBob 1.3s ease-in-out infinite' }}>
            {/* Legs */}
            <rect x="-3" y="-5" width="3" height="10" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="0" y="-5" width="3" height="10" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1.4" />
            <rect x="-4" y="3" width="4" height="3" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
            <rect x="0" y="3" width="4" height="3" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
            {/* Rich blue robe */}
            <path d="M-9 -22 L9 -22 L11 -4 L-11 -4 Z" fill="#2a4a6a" stroke="#0d0a06" strokeWidth="1.8" />
            <path d="M-9 -12 L9 -12" stroke="#f0b840" strokeWidth="1.2" />
            {/* Head */}
            <rect x="-4" y="-32" width="8" height="10" rx="1" fill="#e0b088" stroke="#0d0a06" strokeWidth="1.3" />
            {/* Fancy hat */}
            <path d="M-6 -32 L6 -32 L5 -38 L-5 -38 Z" fill="#5a1a3a" stroke="#0d0a06" strokeWidth="1.4" />
            <circle cx="0" cy="-40" r="1.5" fill="#f0b840" stroke="#0d0a06" strokeWidth="0.8" />
            {/* Small coin bag in hand */}
            <circle cx="8" cy="-4" r="3" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1.2" />
            <circle cx="8" cy="-4" r="1" fill="#f0b840" />
           </g>
          </g>
         </g>
        </g>

        {/* === DOG (runs faster) === */}
        <g transform="translate(230 274)">
         <g className="hero-svg-anim" style={{ animation: 'npcWalk5 6s ease-in-out infinite' }}>
          <g transform="scale(0.9)">
           <g className="hero-svg-anim" style={{ animation: 'npcBob 0.6s ease-in-out infinite' }}>
            {/* Body */}
            <ellipse cx="0" cy="-4" rx="8" ry="4" fill="#7a4f2a" stroke="#0d0a06" strokeWidth="1.4" />
            {/* Head */}
            <circle cx="7" cy="-6" r="3.5" fill="#7a4f2a" stroke="#0d0a06" strokeWidth="1.4" />
            {/* Ears */}
            <path d="M6 -9 L4 -13 L8 -11 Z" fill="#5c3a1e" stroke="#0d0a06" strokeWidth="1" />
            {/* Tail */}
            <path d="M-7 -5 Q-11 -10 -9 -13" fill="none" stroke="#0d0a06" strokeWidth="2" strokeLinecap="round" />
            <path d="M-7 -5 Q-11 -10 -9 -13" fill="none" stroke="#7a4f2a" strokeWidth="1.2" strokeLinecap="round" />
            {/* Legs */}
            <line x1="-5" y1="-1" x2="-5" y2="2" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="-2" y1="-1" x2="-2" y2="2" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="3" y1="-1" x2="3" y2="2" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="6" y1="-1" x2="6" y2="2" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" />
            {/* Eye */}
            <circle cx="8.5" cy="-7" r="0.8" fill="#fff" />
            <circle cx="8.5" cy="-7" r="0.4" fill="#0d0a06" />
           </g>
          </g>
         </g>
        </g>

        </g>

        {/* Grain overlay */}
        <rect x="0" y="0" width="390" height="460" filter="url(#grain)" />
      </svg>

      {/* Animated clouds (CSS layers) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="cloud-drift" style={{ position: 'absolute', top: '8%',  left: 0, width: 74, height: 18, borderRadius: 999, background: 'rgba(255,245,200,0.88)', boxShadow: '0 0 30px rgba(255,220,150,0.5)', animationDuration: '42s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '18%', left: 0, width: 56, height: 14, borderRadius: 999, background: 'rgba(255,245,200,0.72)', animationDuration: '55s', animationDelay: '-14s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '3%',  left: 0, width: 88, height: 20, borderRadius: 999, background: 'rgba(255,245,200,0.8)', animationDuration: '65s', animationDelay: '-28s' }} />
      </div>

      {/* Birds — 4 of them, different heights + speeds */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="bird-fly absolute" style={{ top: '12%', left: 0, width: '100%', height: 14, animationDuration: '24s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q5 0 10 8 Q15 0 20 8" fill="none" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '20%', left: 0, width: '100%', height: 14, animationDuration: '30s', animationDelay: '-6s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q4 2 8 8 Q12 2 16 8" fill="none" stroke="#0d0a06" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '28%', left: 0, width: '100%', height: 14, animationDuration: '36s', animationDelay: '-18s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q3 3 6 8 Q9 3 12 8" fill="none" stroke="#0d0a06" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '9%', left: 0, width: '100%', height: 14, animationDuration: '40s', animationDelay: '-24s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q5 1 10 8 Q15 1 20 8" fill="none" stroke="#0d0a06" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Fireflies — small golden dots that drift near ground and torches */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { left: '18%', top: '72%', delay: '0s',    duration: '8s'  },
          { left: '25%', top: '78%', delay: '-2s',   duration: '10s' },
          { left: '48%', top: '68%', delay: '-4s',   duration: '9s'  },
          { left: '55%', top: '74%', delay: '-1s',   duration: '11s' },
          { left: '70%', top: '76%', delay: '-5s',   duration: '8s'  },
          { left: '82%', top: '70%', delay: '-3s',   duration: '10s' },
        ].map((f, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: f.left,
              top: f.top,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fff6a0 0%, #ffc040 55%, rgba(255,160,40,0) 80%)',
              boxShadow: '0 0 8px 2px rgba(255, 200, 80, 0.8)',
              animation: `fireflyDrift ${f.duration} ease-in-out infinite`,
              animationDelay: f.delay,
            }}
          />
        ))}
      </div>

      {/* Stars — visibility scales with darkness */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: tod.darkness }}>
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
              opacity: 0.85,
              animation: 'softPulse 3s ease-in-out infinite',
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Falling leaves / embers — gentle particles drifting down */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { left: '15%', color: '#c0392b', delay: '0s',   duration: '14s' },
          { left: '32%', color: '#ef7336', delay: '-5s',  duration: '16s' },
          { left: '50%', color: '#f0b840', delay: '-9s',  duration: '15s' },
          { left: '68%', color: '#c0392b', delay: '-2s',  duration: '18s' },
          { left: '84%', color: '#ef7336', delay: '-12s', duration: '14s' },
          { left: '42%', color: '#7a4f2a', delay: '-6s',  duration: '17s' },
        ].map((p, i) => (
          <div
            key={i}
            className="leaf-fall"
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
