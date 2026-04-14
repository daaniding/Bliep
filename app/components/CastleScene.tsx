'use client';

/**
 * CastleScene — full-bleed ultra-realistic (painted) medieval castle
 * hero backdrop with a parallax grass foreground and tiny villager
 * silhouettes that walk horizontally across the scene. Replaces the
 * old KingdomScene3D which was too heavy and visually muddy on phones.
 *
 * The castle image lives at /assets/ui/castle-hero.jpg. Drop a new
 * painting in that file to restyle the whole home without touching
 * code.
 */

type Walker = {
  delay: number;   // seconds before first entrance
  duration: number; // seconds for one full crossing
  bottom: number;  // px offset from grass baseline
  scale: number;   // size multiplier (parallax depth)
  flip: boolean;   // true = walks right → left
  kind: 'peasant' | 'farmer' | 'monk' | 'knightHorse';
  opacity: number;
};

const WALKERS: Walker[] = [
  { delay: 0,   duration: 34, bottom: 6,  scale: 1.00, flip: false, kind: 'peasant',     opacity: 0.95 },
  { delay: 6,   duration: 42, bottom: 14, scale: 0.82, flip: true,  kind: 'farmer',      opacity: 0.88 },
  { delay: 12,  duration: 28, bottom: 2,  scale: 1.15, flip: false, kind: 'knightHorse', opacity: 0.96 },
  { delay: 18,  duration: 48, bottom: 22, scale: 0.68, flip: true,  kind: 'monk',        opacity: 0.78 },
  { delay: 24,  duration: 38, bottom: 10, scale: 0.92, flip: false, kind: 'farmer',      opacity: 0.9  },
  { delay: 30,  duration: 52, bottom: 28, scale: 0.6,  flip: true,  kind: 'peasant',     opacity: 0.7  },
];

export default function CastleScene() {
  return (
    <div className="castle-scene">
      {/* Castle painting — full bleed */}
      <div className="castle-bg" />
      {/* Subtle warm atmosphere wash */}
      <div className="castle-haze" />
      {/* Top vignette so the HUD always stays readable */}
      <div className="castle-top-vignette" />

      {/* Grass foreground strip */}
      <div className="grass-strip">
        <div className="grass-gradient" />
        <div className="grass-blades" />
      </div>

      {/* Tiny walkers between castle and grass */}
      <div className="walker-lane">
        {WALKERS.map((w, i) => (
          <div
            key={i}
            className="walker"
            style={{
              bottom: w.bottom,
              animationDelay: `-${w.delay}s`,
              animationDuration: `${w.duration}s`,
              animationName: w.flip ? 'walkRight' : 'walkLeft',
              opacity: w.opacity,
            }}
          >
            <div
              className={`walker-sprite sprite-${w.kind} ${w.flip ? 'flipped' : ''}`}
              style={{ transform: `scale(${w.scale})` }}
            />
          </div>
        ))}
      </div>

      {/* Firefly-like dust motes for atmosphere */}
      <div className="dust-motes">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="dust"
            style={{
              left: `${(i * 83) % 100}%`,
              bottom: `${20 + ((i * 37) % 50)}%`,
              animationDelay: `${(i * 0.9) % 6}s`,
              animationDuration: `${5 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .castle-scene {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #0d0a06;
        }

        .castle-bg {
          position: absolute;
          inset: 0;
          background-image: url('/assets/ui/castle-hero.jpg');
          background-size: cover;
          background-position: 50% 42%;
          background-repeat: no-repeat;
          transform: scale(1.08);
          animation: castleDrift 28s ease-in-out infinite alternate;
        }

        .castle-haze {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 90% 60% at 50% 95%,
              rgba(120, 40, 10, 0.45) 0%,
              rgba(40, 15, 5, 0.0) 70%),
            linear-gradient(180deg,
              rgba(255, 170, 80, 0.04) 0%,
              rgba(0, 0, 0, 0.0) 40%,
              rgba(30, 10, 0, 0.35) 100%);
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .castle-top-vignette {
          position: absolute;
          inset: 0 0 60% 0;
          background: linear-gradient(
            180deg,
            rgba(10, 5, 0, 0.55) 0%,
            rgba(10, 5, 0, 0.0) 100%
          );
          pointer-events: none;
        }

        /* ---- Grass foreground ---- */
        .grass-strip {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 132px;
          height: 72px;
          pointer-events: none;
        }

        .grass-gradient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 120% 80% at 50% 0%,
              rgba(255, 150, 60, 0.22) 0%,
              rgba(255, 100, 30, 0.0) 60%),
            linear-gradient(180deg,
              rgba(40, 70, 25, 0.0) 0%,
              rgba(55, 95, 35, 0.75) 22%,
              rgba(28, 60, 22, 0.95) 55%,
              #0c2a10 82%,
              #061605 100%);
        }

        .grass-blades {
          position: absolute;
          inset: auto 0 0 0;
          height: 72px;
          background-image:
            radial-gradient(circle at 12% 92%, rgba(80, 140, 60, 0.7) 0 1.2px, transparent 1.6px),
            radial-gradient(circle at 27% 88%, rgba(60, 110, 45, 0.6) 0 1px,   transparent 1.4px),
            radial-gradient(circle at 41% 94%, rgba(95, 160, 70, 0.65) 0 1.1px, transparent 1.5px),
            radial-gradient(circle at 58% 90%, rgba(70, 120, 50, 0.55) 0 1px,   transparent 1.4px),
            radial-gradient(circle at 73% 93%, rgba(90, 150, 65, 0.6)  0 1.1px, transparent 1.5px),
            radial-gradient(circle at 88% 89%, rgba(55, 100, 40, 0.55) 0 1px,   transparent 1.4px);
          background-size: 180px 72px;
          opacity: 0.85;
          filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.5));
        }

        /* ---- Walker lane ---- */
        .walker-lane {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 148px;
          height: 60px;
          pointer-events: none;
        }

        .walker {
          position: absolute;
          left: 0;
          bottom: 0;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
          filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.65));
        }

        @keyframes walkLeft {
          0%   { transform: translateX(-12vw); }
          100% { transform: translateX(112vw); }
        }
        @keyframes walkRight {
          0%   { transform: translateX(112vw); }
          100% { transform: translateX(-12vw); }
        }

        .walker-sprite {
          width: 28px;
          height: 44px;
          transform-origin: center bottom;
          background-repeat: no-repeat;
          background-position: center bottom;
          background-size: contain;
          animation: walkBob 0.55s ease-in-out infinite;
        }
        .walker-sprite.flipped {
          transform: scaleX(-1);
        }

        @keyframes walkBob {
          0%, 100% { translate: 0 0; }
          50%      { translate: 0 -1.5px; }
        }

        /* Silhouettes as inline SVG data URIs — dark figures read
           cleanly at small size against the grass. */
        .sprite-peasant {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 44'><g fill='%23120a03'><circle cx='14' cy='7' r='4'/><rect x='10.5' y='11' width='7' height='13' rx='2'/><rect x='9' y='24' width='4' height='14' rx='1.4'/><rect x='15' y='24' width='4' height='14' rx='1.4'/><rect x='6' y='15' width='3' height='9' rx='1.2'/><rect x='19' y='15' width='3' height='9' rx='1.2'/></g></svg>");
        }
        .sprite-farmer {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 44'><g fill='%230f0803'><path d='M9 6 Q14 1 19 6 L21 9 L7 9 Z'/><circle cx='14' cy='9' r='3.5'/><rect x='10.5' y='12' width='7' height='13' rx='2'/><rect x='9' y='25' width='4' height='14' rx='1.4'/><rect x='15' y='25' width='4' height='14' rx='1.4'/><rect x='20' y='4' width='1.6' height='24' rx='0.6'/><rect x='19' y='3' width='3.6' height='2' rx='0.5'/></g></svg>");
        }
        .sprite-monk {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 44'><g fill='%23100703'><circle cx='14' cy='8' r='4'/><path d='M8 14 Q14 10 20 14 L22 38 L6 38 Z'/><rect x='11' y='22' width='6' height='3'/></g></svg>");
        }
        .sprite-knightHorse {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 44'><g fill='%23090502'><path d='M4 32 Q6 22 16 21 L36 21 Q46 19 50 15 L52 18 Q48 25 38 27 L38 34 L34 34 L34 29 L18 29 L18 34 L14 34 L14 29 L8 34 Z'/><path d='M36 20 L38 14 L41 14 L40 20 Z'/><rect x='37' y='7' width='2' height='8'/><path d='M37 7 L43 9 L37 11 Z'/><circle cx='37' cy='14' r='3.2'/></g></svg>");
          width: 56px;
          height: 44px;
        }

        /* ---- Dust motes ---- */
        .dust-motes {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .dust {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(255, 220, 140, 0.75);
          box-shadow: 0 0 6px rgba(255, 200, 100, 0.7);
          animation-name: dustDrift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes dustDrift {
          0%, 100% { transform: translate(0, 0);      opacity: 0.2; }
          50%      { transform: translate(6px, -10px); opacity: 0.9; }
        }

        @keyframes castleDrift {
          0%   { transform: scale(1.08) translate(0, 0); }
          100% { transform: scale(1.12) translate(-6px, -4px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .castle-bg,
          .walker,
          .walker-sprite,
          .dust {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
