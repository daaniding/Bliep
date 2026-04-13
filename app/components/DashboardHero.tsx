'use client';

// Hand-crafted SVG hero scene — warm medieval kingdom at dusk.
// Sky gradient + sun halo, distant mountains, a castle with three
// towers and gate, banners on top, a knight figure in the foreground,
// drifting clouds (CSS), and a few birds flying across (CSS).

export default function DashboardHero() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: '16 / 11',
        borderBottom: '3px solid #0d0a06',
        boxShadow: 'inset 0 -30px 40px -10px rgba(0, 0, 0, 0.55)',
      }}
    >
      {/* Sky + world via one SVG */}
      <svg
        viewBox="0 0 420 290"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Warm sunset gradient */}
          <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffd68a" />
            <stop offset="30%" stopColor="#ffa560" />
            <stop offset="60%" stopColor="#c85a2a" />
            <stop offset="100%" stopColor="#3a1410" />
          </linearGradient>
          {/* Sun halo */}
          <radialGradient id="heroSun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"  stopColor="#fff6dc" />
            <stop offset="35%" stopColor="#ffd97a" />
            <stop offset="80%" stopColor="rgba(255, 180, 80, 0)" />
          </radialGradient>
          {/* Distant mountains */}
          <linearGradient id="heroMountains" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a1e0e" />
            <stop offset="100%" stopColor="#1a0f05" />
          </linearGradient>
          {/* Castle stone */}
          <linearGradient id="heroStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b6838" />
            <stop offset="60%" stopColor="#5c3a1e" />
            <stop offset="100%" stopColor="#2a1a0a" />
          </linearGradient>
          <linearGradient id="heroStoneHighlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Tower roofs — red tile */}
          <linearGradient id="heroRoof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e67260" />
            <stop offset="60%" stopColor="#c0392b" />
            <stop offset="100%" stopColor="#5a0f00" />
          </linearGradient>
          {/* Ground */}
          <linearGradient id="heroGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#5a3718" />
            <stop offset="100%" stopColor="#1a0f05" />
          </linearGradient>
          {/* Knight armor */}
          <linearGradient id="knightArmor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#d7d7d7" />
            <stop offset="60%" stopColor="#6a6a6a" />
            <stop offset="100%" stopColor="#2a2a2a" />
          </linearGradient>

          {/* Grain filter */}
          <filter id="heroGrain">
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width="420" height="290" fill="url(#heroSky)" />

        {/* Sun halo */}
        <circle cx="310" cy="80" r="90" fill="url(#heroSun)" />
        <circle cx="310" cy="80" r="28" fill="#fff6dc" opacity="0.95" />

        {/* Distant mountain silhouettes */}
        <path
          d="M0 200 L40 160 L90 190 L140 140 L200 180 L260 150 L320 185 L380 155 L420 180 L420 290 L0 290 Z"
          fill="url(#heroMountains)"
          opacity="0.85"
        />

        {/* Ground/grass */}
        <rect x="0" y="220" width="420" height="70" fill="url(#heroGround)" />
        {/* Grass hint */}
        {[...Array(20)].map((_, i) => (
          <line
            key={i}
            x1={10 + i * 22}
            y1="222"
            x2={10 + i * 22 + ((i % 2) ? 3 : -3)}
            y2="215"
            stroke="#3a5a1a"
            strokeWidth="1.5"
            opacity="0.6"
          />
        ))}
        <path d="M0 222 Q100 214 210 222 Q320 230 420 216 L420 222 Z" fill="#1a0f05" opacity="0.5" />

        {/* === CASTLE === */}

        {/* Back wall */}
        <rect x="100" y="140" width="220" height="80" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="2" />
        {/* Crenellations on wall */}
        {[...Array(10)].map((_, i) => (
          <rect key={i} x={102 + i * 22} y="132" width="12" height="12" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="1.5" />
        ))}
        {/* Stone brick lines on wall */}
        <g stroke="#1a0f05" strokeWidth="1" opacity="0.55">
          <line x1="100" y1="160" x2="320" y2="160" />
          <line x1="100" y1="180" x2="320" y2="180" />
          <line x1="100" y1="200" x2="320" y2="200" />
          <line x1="140" y1="140" x2="140" y2="220" />
          <line x1="180" y1="160" x2="180" y2="180" />
          <line x1="220" y1="180" x2="220" y2="200" />
          <line x1="260" y1="140" x2="260" y2="160" />
          <line x1="280" y1="200" x2="280" y2="220" />
        </g>

        {/* Main keep (center) */}
        <rect x="170" y="90" width="80" height="130" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="2" />
        <rect x="170" y="90" width="80" height="130" fill="url(#heroStoneHighlight)" />
        {/* Keep crenellations */}
        {[...Array(4)].map((_, i) => (
          <rect key={i} x={174 + i * 20} y="82" width="12" height="12" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="1.5" />
        ))}
        {/* Keep window */}
        <rect x="198" y="130" width="24" height="28" fill="#1a0f05" stroke="#0d0a06" strokeWidth="1.5" />
        <circle cx="210" cy="135" r="6" fill="#ffd97a" opacity="0.8" />
        <rect x="204" y="140" width="12" height="18" fill="#1a0f05" />
        {/* Keep door */}
        <path d="M200 190 Q200 178 210 178 Q220 178 220 190 L220 220 L200 220 Z" fill="#1a0f05" stroke="#0d0a06" strokeWidth="2" />

        {/* Left tower */}
        <rect x="80" y="100" width="44" height="120" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="2" />
        <rect x="80" y="100" width="44" height="120" fill="url(#heroStoneHighlight)" />
        {[...Array(3)].map((_, i) => (
          <rect key={i} x={82 + i * 14} y="92" width="10" height="10" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="1.5" />
        ))}
        {/* Left tower roof (conical) */}
        <polygon points="78,100 102,50 126,100" fill="url(#heroRoof)" stroke="#0d0a06" strokeWidth="2" />
        {/* Flagpole + flag */}
        <line x1="102" y1="50" x2="102" y2="28" stroke="#0d0a06" strokeWidth="1.5" />
        <path d="M102 30 L118 34 L102 40 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="1.5" />

        {/* Right tower */}
        <rect x="296" y="100" width="44" height="120" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="2" />
        <rect x="296" y="100" width="44" height="120" fill="url(#heroStoneHighlight)" />
        {[...Array(3)].map((_, i) => (
          <rect key={i} x={298 + i * 14} y="92" width="10" height="10" fill="url(#heroStone)" stroke="#0d0a06" strokeWidth="1.5" />
        ))}
        <polygon points="294,100 318,50 342,100" fill="url(#heroRoof)" stroke="#0d0a06" strokeWidth="2" />
        <line x1="318" y1="50" x2="318" y2="28" stroke="#0d0a06" strokeWidth="1.5" />
        <path d="M318 30 L334 34 L318 40 Z" fill="#c0392b" stroke="#0d0a06" strokeWidth="1.5" />

        {/* Center keep spire */}
        <polygon points="168,90 210,40 252,90" fill="url(#heroRoof)" stroke="#0d0a06" strokeWidth="2" />
        <line x1="210" y1="40" x2="210" y2="14" stroke="#0d0a06" strokeWidth="2" />
        <path d="M210 16 L234 22 L210 30 Z" fill="#f0b840" stroke="#0d0a06" strokeWidth="1.5" />

        {/* Torch glow on keep */}
        <circle cx="175" cy="148" r="4" fill="#ffb866" opacity="0.85" />
        <circle cx="245" cy="148" r="4" fill="#ffb866" opacity="0.85" />

        {/* Smoke from keep */}
        <g opacity="0.35">
          <circle cx="190" cy="70" r="5" fill="#ddd" />
          <circle cx="196" cy="64" r="5" fill="#ddd" />
          <circle cx="202" cy="60" r="5" fill="#ddd" />
        </g>

        {/* === KNIGHT in foreground === */}
        <g transform="translate(60 210)">
          {/* Shield */}
          <path d="M-18 -10 L-4 -14 L10 -10 L10 12 L-4 22 L-18 12 Z"
            fill="#c0392b" stroke="#0d0a06" strokeWidth="2" strokeLinejoin="round" />
          <path d="M-14 -8 L-4 -11 L6 -8 L6 10 L-4 18 L-14 10 Z" fill="none" stroke="#f0b840" strokeWidth="1.5" />
          <path d="M-4 -6 L-4 16 M-10 6 L2 6" stroke="#f0b840" strokeWidth="1.8" />
          {/* Body */}
          <rect x="8" y="-6" width="12" height="22" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="1.5" />
          {/* Arm holding sword */}
          <rect x="18" y="-4" width="4" height="14" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="1.2" />
          <rect x="19" y="-20" width="2" height="16" fill="#d7d7d7" stroke="#0d0a06" strokeWidth="1" />
          {/* Head with helm */}
          <rect x="10" y="-20" width="10" height="14" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="1.5" />
          <rect x="11" y="-15" width="8" height="2" fill="#0d0a06" />
          <rect x="11" y="-22" width="10" height="3" fill="url(#knightArmor)" stroke="#0d0a06" strokeWidth="1" />
          {/* Feet */}
          <rect x="8" y="16" width="5" height="5" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
          <rect x="15" y="16" width="5" height="5" fill="#2a1a0a" stroke="#0d0a06" strokeWidth="1" />
        </g>

        {/* Noise grain over the whole scene */}
        <rect x="0" y="0" width="420" height="290" filter="url(#heroGrain)" />
      </svg>

      {/* Animated clouds (CSS layers) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="cloud-drift" style={{ position: 'absolute', top: '12%', left: 0, width: 60, height: 16, borderRadius: 999, background: 'rgba(255,245,200,0.9)', boxShadow: '0 0 28px rgba(255,220,150,0.5)', animationDuration: '38s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '24%', left: 0, width: 48, height: 12, borderRadius: 999, background: 'rgba(255,245,200,0.75)', animationDuration: '52s', animationDelay: '-10s' }} />
        <div className="cloud-drift" style={{ position: 'absolute', top: '6%', left: 0, width: 80, height: 20, borderRadius: 999, background: 'rgba(255,245,200,0.85)', animationDuration: '60s', animationDelay: '-25s' }} />
      </div>

      {/* Animated birds */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="bird-fly absolute" style={{ top: '18%', left: 0, width: '100%', height: 10, animationDuration: '22s' }} viewBox="0 0 40 10">
          <path d="M0 6 Q4 0 8 6 Q12 0 16 6" fill="none" stroke="#0d0a06" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <svg className="bird-fly absolute" style={{ top: '28%', left: 0, width: '100%', height: 10, animationDuration: '28s', animationDelay: '-6s' }} viewBox="0 0 40 10">
          <path d="M0 6 Q3 2 6 6 Q9 2 12 6" fill="none" stroke="#0d0a06" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
