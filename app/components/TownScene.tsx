'use client';

// A composed pixel-art town scene using Kenney Medieval RTS sprites.
// Renders as a wide "stage" above the hero panel — grass ground line,
// a few buildings, trees, and a character. Static but sets the vibe.

interface SpriteItem {
  src: string;
  left: string;
  bottom: string;
  width: number;
  z?: number;
}

const SCENE: SpriteItem[] = [
  // Background trees
  { src: '/assets/kenney/environment/medievalEnvironment_03.png', left: '6%', bottom: '18%', width: 32, z: 1 },
  { src: '/assets/kenney/environment/medievalEnvironment_05.png', left: '88%', bottom: '22%', width: 28, z: 1 },

  // Middle row: houses / castle
  { src: '/assets/kenney/buildings/medievalStructure_17.png', left: '20%', bottom: '12%', width: 52, z: 2 },
  { src: '/assets/kenney/buildings/medievalStructure_21.png', left: '42%', bottom: '8%', width: 68, z: 3 }, // center castle
  { src: '/assets/kenney/buildings/medievalStructure_12.png', left: '68%', bottom: '14%', width: 44, z: 2 },

  // Front: trees + characters
  { src: '/assets/kenney/environment/medievalEnvironment_01.png', left: '12%', bottom: '4%', width: 26, z: 4 },
  { src: '/assets/kenney/units/medievalUnit_01.png', left: '34%', bottom: '2%', width: 22, z: 5 },
  { src: '/assets/kenney/units/medievalUnit_05.png', left: '60%', bottom: '2%', width: 22, z: 5 },
  { src: '/assets/kenney/environment/medievalEnvironment_07.png', left: '80%', bottom: '4%', width: 24, z: 4 },
];

export default function TownScene() {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        height: 140,
        background:
          'linear-gradient(180deg, #1b3b5a 0%, #2a5a7a 25%, #c6c38a 65%, #6ba368 78%, #4a7d4a 100%)',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4), inset 0 -2px 6px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.4)',
      }}
    >
      {/* Sun halo */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 12,
          right: 22,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FFE99A 0%, #F5D068 40%, transparent 70%)',
          boxShadow: '0 0 28px 8px rgba(232, 184, 74, 0.45)',
        }}
      />
      {/* Cloud blobs */}
      <div aria-hidden style={{ position: 'absolute', top: 20, left: '10%', width: 44, height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.75)', boxShadow: '0 0 18px rgba(255,255,255,0.4)' }} />
      <div aria-hidden style={{ position: 'absolute', top: 34, left: '62%', width: 38, height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.6)' }} />

      {/* Sprites */}
      {SCENE.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt=""
          className="sprite-pixel absolute"
          style={{
            left: s.left,
            bottom: s.bottom,
            width: s.width,
            height: 'auto',
            zIndex: s.z ?? 1,
            transform: 'translateX(-50%)',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.4))',
          }}
        />
      ))}
    </div>
  );
}
