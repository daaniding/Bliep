'use client';

/**
 * KingdomScene2D — top-down Kenney-tile village that fills the home
 * scene area. Replaces CastleScene (which was a flat matte painting)
 * with something that reads like Clash of Clans / Forge of Empires:
 * you look down on YOUR kingdom, buildings sit on grass, villagers
 * wander between them, smoke drifts from chimneys, a flag waves on
 * the keep. The scene IS the game, not a wallpaper behind it.
 *
 * All sprites come from public/assets/kenney/*. They're ~64px native
 * and rendered with image-rendering: pixelated so they stay crisp
 * when scaled up.
 */

type Sprite = {
  src: string;
  left: string; // % of scene width
  top: string;  // % of scene height
  size: number; // rendered px
  z: number;    // paint order — higher = in front
  rotate?: number;
};

// ---- Static decor placements (everything that doesn't move) --------
const DECOR: Sprite[] = [
  // Back castle wall line — across the upper strip
  { src: 'buildings/medievalStructure_01.png', left: '12%', top: '10%', size: 88, z: 20 }, // corner tower left
  { src: 'buildings/medievalStructure_02.png', left: '28%', top: '13%', size: 82, z: 19 }, // battlement wall
  { src: 'buildings/medievalStructure_12.png', left: '44%', top: '5%',  size: 96, z: 22 }, // keep tower (center, tallest)
  { src: 'buildings/medievalStructure_02.png', left: '60%', top: '13%', size: 82, z: 19 }, // battlement wall
  { src: 'buildings/medievalStructure_01.png', left: '76%', top: '10%', size: 88, z: 20 }, // corner tower right
  { src: 'buildings/medievalStructure_06.png', left: '44%', top: '22%', size: 80, z: 24 }, // front gate

  // Village buildings — scattered on the grass below
  { src: 'buildings/medievalStructure_04.png', left: '72%', top: '34%', size: 72, z: 30 }, // church (right)
  { src: 'buildings/medievalStructure_16.png', left: '18%', top: '38%', size: 64, z: 30 }, // house
  { src: 'buildings/medievalStructure_17.png', left: '36%', top: '42%', size: 64, z: 31 }, // house
  { src: 'buildings/medievalStructure_20.png', left: '58%', top: '45%', size: 64, z: 32 }, // house
  { src: 'buildings/medievalStructure_21.png', left: '14%', top: '55%', size: 64, z: 33 }, // house
  { src: 'buildings/medievalStructure_18.png', left: '44%', top: '58%', size: 64, z: 34 }, // house
  { src: 'buildings/medievalStructure_19.png', left: '72%', top: '60%', size: 64, z: 35 }, // house
  { src: 'buildings/medievalStructure_22.png', left: '30%', top: '68%', size: 64, z: 36 }, // market stall
  { src: 'buildings/medievalStructure_09.png', left: '58%', top: '72%', size: 64, z: 37 }, // cabin

  // Farmland / crates / wooden crosses — bottom-left cluster
  { src: 'buildings/medievalStructure_13.png', left: '6%',  top: '74%', size: 56, z: 40 },
  { src: 'buildings/medievalStructure_14.png', left: '16%', top: '80%', size: 56, z: 41 },
  { src: 'buildings/medievalStructure_15.png', left: '6%',  top: '86%', size: 56, z: 42 },

  // Environment details — trees, rocks, boulders
  { src: 'environment/medievalEnvironment_01.png', left: '4%',  top: '30%', size: 44, z: 25 },
  { src: 'environment/medievalEnvironment_01.png', left: '90%', top: '28%', size: 44, z: 25 },
  { src: 'environment/medievalEnvironment_01.png', left: '86%', top: '48%', size: 40, z: 28 },
  { src: 'environment/medievalEnvironment_01.png', left: '2%',  top: '64%', size: 40, z: 28 },
  { src: 'environment/medievalEnvironment_01.png', left: '50%', top: '82%', size: 40, z: 45 },
  { src: 'environment/medievalEnvironment_01.png', left: '90%', top: '80%', size: 44, z: 45 },
  { src: 'environment/medievalEnvironment_18.png', left: '26%', top: '28%', size: 32, z: 26 },
  { src: 'environment/medievalEnvironment_12.png', left: '68%', top: '30%', size: 30, z: 26 },
  { src: 'environment/medievalEnvironment_15.png', left: '84%', top: '70%', size: 30, z: 43 },
];

// ---- Walkers: villagers that path between points ------------------
// Each walker gets its own CSS animation with waypoints, a base size
// and a staggered delay so the scene feels alive the moment it loads.
type Walker = {
  src: string;
  size: number;
  duration: number;
  delay: number;
  path: { x: string; y: string }[];
};

const WALKERS: Walker[] = [
  {
    src: 'units/medievalUnit_05.png',
    size: 64,
    duration: 22,
    delay: 0,
    path: [
      { x: '22%', y: '48%' },
      { x: '40%', y: '52%' },
      { x: '58%', y: '50%' },
      { x: '40%', y: '56%' },
      { x: '22%', y: '48%' },
    ],
  },
  {
    src: 'units/medievalUnit_10.png',
    size: 68,
    duration: 28,
    delay: 2,
    path: [
      { x: '48%', y: '36%' },
      { x: '48%', y: '62%' },
      { x: '36%', y: '74%' },
      { x: '48%', y: '36%' },
    ],
  },
  {
    src: 'units/medievalUnit_15.png',
    size: 64,
    duration: 34,
    delay: 5,
    path: [
      { x: '76%', y: '44%' },
      { x: '66%', y: '58%' },
      { x: '80%', y: '68%' },
      { x: '76%', y: '44%' },
    ],
  },
  {
    src: 'units/medievalUnit_20.png',
    size: 64,
    duration: 26,
    delay: 8,
    path: [
      { x: '14%', y: '62%' },
      { x: '26%', y: '74%' },
      { x: '18%', y: '84%' },
      { x: '10%', y: '70%' },
      { x: '14%', y: '62%' },
    ],
  },
  {
    src: 'units/medievalUnit_01.png',
    size: 64,
    duration: 30,
    delay: 11,
    path: [
      { x: '44%', y: '30%' },
      { x: '52%', y: '40%' },
      { x: '44%', y: '30%' },
    ],
  },
];

function pathToKeyframes(name: string, path: Walker['path']) {
  // Animate left/top as percentages of the scene parent. We transform
  // by -50% -50% separately so left/top reference the sprite center.
  const steps = path
    .map((p, i) => {
      const pct = Math.round((i / (path.length - 1)) * 100);
      return `${pct}% { left: ${p.x}; top: ${p.y}; }`;
    })
    .join('\n');
  return `@keyframes ${name} {\n${steps}\n}`;
}

export default function KingdomScene2D() {
  const walkerKeyframes = WALKERS.map((w, i) =>
    pathToKeyframes(`walk${i}`, w.path)
  ).join('\n');

  return (
    <div className="kingdom2d">
      {/* Grass field base + subtle warm sun wash */}
      <div className="kingdom2d-ground" />
      <div className="kingdom2d-path" />
      <div className="kingdom2d-sun" />

      {/* Static decor sprites */}
      {DECOR.map((s, i) => (
        <img
          key={`d${i}`}
          src={`/assets/kenney/${s.src}`}
          alt=""
          className="sprite"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            zIndex: s.z,
            transform: `translate(-50%, -50%)${s.rotate ? ` rotate(${s.rotate}deg)` : ''}`,
          }}
        />
      ))}

      {/* Chimney smoke over a few houses */}
      <div className="smoke" style={{ left: '18%', top: '34%' }} />
      <div className="smoke" style={{ left: '44%', top: '54%', animationDelay: '1.2s' }} />
      <div className="smoke" style={{ left: '72%', top: '56%', animationDelay: '2.3s' }} />

      {/* Flag flying on the keep */}
      <div className="flag" style={{ left: '48%', top: '2%' }}>
        <div className="flag-pole" />
        <div className="flag-cloth" />
      </div>

      {/* Walkers */}
      {WALKERS.map((w, i) => (
        <div
          key={`w${i}`}
          className="walker"
          style={{
            width: w.size,
            height: w.size,
            animation: `walk${i} ${w.duration}s linear ${-w.delay}s infinite`,
            zIndex: 50,
          }}
        >
          <img
            src={`/assets/kenney/${w.src}`}
            alt=""
            className="sprite-walker"
            style={{ width: w.size, height: w.size }}
          />
        </div>
      ))}

      <style jsx>{`
        .kingdom2d {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #0d0a06;
        }

        .kingdom2d-ground {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 110% 80% at 50% 55%,
              #6aa84b 0%,
              #4f8a3a 38%,
              #2f5a24 70%,
              #1a3614 100%);
        }

        /* Stone path leading from the castle gate down to the village */
        .kingdom2d-path {
          position: absolute;
          left: 42%;
          top: 24%;
          width: 16%;
          height: 70%;
          background:
            linear-gradient(180deg,
              rgba(200, 180, 140, 0.65) 0%,
              rgba(150, 130, 95, 0.55) 100%);
          border-radius: 50% / 8%;
          filter: blur(0.4px);
          z-index: 10;
          transform: skewX(-3deg);
        }

        .kingdom2d-sun {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 70% 50% at 50% 18%,
            rgba(255, 220, 140, 0.35) 0%,
            rgba(255, 180, 80, 0.0) 60%
          );
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .sprite {
          position: absolute;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.55));
          pointer-events: none;
          user-select: none;
        }

        .walker {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          will-change: left, top;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6));
        }
        .sprite-walker {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          animation: bob 0.55s ease-in-out infinite;
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }

        /* Smoke puff rising from a chimney */
        .smoke {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0) 70%);
          filter: blur(2px);
          animation: smokeRise 3.6s ease-out infinite;
          transform: translate(-50%, -50%);
          z-index: 60;
          pointer-events: none;
        }
        @keyframes smokeRise {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          25%  { opacity: 0.9; }
          100% { transform: translate(-50%, -160%) scale(1.8); opacity: 0; }
        }

        /* Keep flag */
        .flag {
          position: absolute;
          width: 26px;
          height: 30px;
          transform: translate(-50%, 0);
          z-index: 70;
          pointer-events: none;
        }
        .flag-pole {
          position: absolute;
          left: 12px;
          top: 0;
          width: 2px;
          height: 26px;
          background: #2a1a0a;
        }
        .flag-cloth {
          position: absolute;
          left: 14px;
          top: 2px;
          width: 12px;
          height: 8px;
          background: linear-gradient(90deg, #c0392b 0%, #7a1e0a 100%);
          border-top: 1px solid #3d0a00;
          border-bottom: 1px solid #3d0a00;
          transform-origin: left center;
          animation: flagWave2 1.4s ease-in-out infinite;
        }
        @keyframes flagWave2 {
          0%, 100% { transform: scaleX(1)    skewY(-3deg); }
          50%      { transform: scaleX(0.85) skewY( 3deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .walker, .sprite-walker, .flag-cloth, .smoke {
            animation: none !important;
          }
        }

        ${walkerKeyframes}
      `}</style>
    </div>
  );
}
