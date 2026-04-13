'use client';

// Dense hand-drawn SVG hero scene — medieval kingdom at sunset.
// Layered parallax (sky / far mountains / near mountains / castle /
// foreground with knight), all strongly outlined with dark strokes,
// warm gradients, stone textures, flame animations and real detail.
// Target: recognizable, not generic.

export default function DashboardHero() {
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
          <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffe39a" />
            <stop offset="25%" stopColor="#ffb458" />
            <stop offset="55%" stopColor="#ef7336" />
            <stop offset="85%" stopColor="#70290e" />
            <stop offset="100%" stopColor="#2a0f04" />
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

        {/* Sun halo + disc — positioned behind the central keep */}
        <circle cx="300" cy="120" r="130" fill="url(#heroSun)" />
        <circle cx="300" cy="120" r="42" fill="#fff6dc" opacity="0.98" />
        <circle cx="300" cy="120" r="32" fill="#ffdb7c" />

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
        {/* Window */}
        <path d="M82 150 Q82 142 87 142 Q92 142 92 150 L92 164 L82 164 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="87" cy="150" r="4" fill="url(#windowGlow)" />
        {/* Conical roof */}
        <polygon points="52,122 87,72 122,122" fill="url(#roofRed)" stroke="#0d0a06" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="87,72 122,122 87,112" fill="rgba(0,0,0,0.35)" />
        {/* Roof bands */}
        <line x1="69" y1="96" x2="105" y2="96" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="61" y1="116" x2="113" y2="116" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        {/* Flag */}
        <line x1="87" y1="72" x2="87" y2="46" stroke="#0d0a06" strokeWidth="2" />
        <path d="M87 48 L106 54 L87 62 Z" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.5" />

        {/* === RIGHT TOWER === */}
        <rect x="276" y="122" width="54" height="138" fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="3" />
        <rect x="316" y="122" width="14" height="138" fill="url(#roofShadow)" />
        <g fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(4)].map((_, i) => (
            <rect key={i} x={278 + i * 13} y="112" width="9" height="12" />
          ))}
        </g>
        <path d="M298 150 Q298 142 303 142 Q308 142 308 150 L308 164 L298 164 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="303" cy="150" r="4" fill="url(#windowGlow)" />
        <polygon points="268,122 303,72 338,122" fill="url(#roofRed)" stroke="#0d0a06" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="303,72 338,122 303,112" fill="rgba(0,0,0,0.35)" />
        <line x1="285" y1="96" x2="321" y2="96" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="277" y1="116" x2="329" y2="116" stroke="#0d0a06" strokeWidth="1.5" opacity="0.6" />
        <line x1="303" y1="72" x2="303" y2="46" stroke="#0d0a06" strokeWidth="2" />
        <path d="M303 48 L322 54 L303 62 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="1.5" />

        {/* === MAIN KEEP === */}
        <rect x="160" y="88" width="70" height="172" fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="3" />
        <rect x="215" y="88" width="15" height="172" fill="url(#roofShadow)" />
        {/* Keep crenellations */}
        <g fill="url(#stoneLight)" stroke="#0d0a06" strokeWidth="2">
          {[...Array(5)].map((_, i) => (
            <rect key={i} x={162 + i * 14} y="78" width="10" height="12" />
          ))}
        </g>
        {/* Keep window (upper) */}
        <path d="M180 114 Q180 105 190 105 Q200 105 200 114 L200 132 L180 132 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="190" cy="116" r="6" fill="url(#windowGlow)" />
        {/* Keep window (middle) */}
        <path d="M205 148 Q205 141 210 141 Q215 141 215 148 L215 160 L205 160 Z" fill="#2a1205" stroke="#0d0a06" strokeWidth="2" />
        <circle cx="210" cy="150" r="3" fill="url(#windowGlow)" />
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
        {/* Gate torches */}
        <circle cx="172" cy="210" r="10" fill="url(#torchFlame)" />
        <rect x="170" y="210" width="4" height="10" fill="#3a1208" stroke="#0d0a06" strokeWidth="1" />
        <circle cx="218" cy="210" r="10" fill="url(#torchFlame)" />
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
        <path d="M195 8 L220 14 L195 22 Z" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.5" />
        <circle cx="195" cy="6" r="2.5" fill="#f0b840" stroke="#0d0a06" strokeWidth="1" />

        {/* Smoke from keep top */}
        <g opacity="0.35">
          <circle cx="172" cy="60" r="4" fill="#eee" />
          <circle cx="178" cy="54" r="5" fill="#eee" />
          <circle cx="184" cy="48" r="4" fill="#eee" />
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

        {/* === KNIGHT (big, foreground) === */}
        <g transform="translate(50 262) scale(1.3)">
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

        {/* Grain overlay */}
        <rect x="0" y="0" width="390" height="460" filter="url(#grain)" />
      </svg>

      {/* Animated clouds (CSS layers) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="cloud-drift" style={{ position: 'absolute', top: '8%',  left: 0, width: 74, height: 18, borderRadius: 999, background: 'rgba(255,245,200,0.88)', boxShadow: '0 0 30px rgba(255,220,150,0.5)', animationDuration: '42s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '18%', left: 0, width: 56, height: 14, borderRadius: 999, background: 'rgba(255,245,200,0.72)', animationDuration: '55s', animationDelay: '-14s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '3%',  left: 0, width: 88, height: 20, borderRadius: 999, background: 'rgba(255,245,200,0.8)', animationDuration: '65s', animationDelay: '-28s' }} />
      </div>

      {/* Birds */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="bird-fly absolute" style={{ top: '15%', left: 0, width: '100%', height: 14, animationDuration: '26s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q5 0 10 8 Q15 0 20 8" fill="none" stroke="#0d0a06" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '24%', left: 0, width: '100%', height: 14, animationDuration: '32s', animationDelay: '-8s' }} viewBox="0 0 40 14">
          <path d="M0 8 Q4 2 8 8 Q12 2 16 8" fill="none" stroke="#0d0a06" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
