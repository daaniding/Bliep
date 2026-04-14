'use client';

import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Frame-perfect cinematic hero scene:
//   • painted castle still as base
//   • drifting clouds / haze
//   • dragon flies across at frame 30
//   • fireflies pulse continuously
//   • knight bobs on the cliff
//   • subtle vignette + sunset color grade
//
// Composed as a Remotion <Composition>. Loops every 240 frames @ 30fps = 8s.

const CASTLE_SRC = '/assets/ui/castle-hero.jpg';
const KNIGHT_SRC = '/assets/ui/knight.jpeg';
const DRAGON_SRC = '/assets/ui/dragon.jpeg';

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Loop-friendly progress 0..1
  const t = (frame % durationInFrames) / durationInFrames;

  // === Castle gentle Ken Burns ===
  const kenBurnsScale = interpolate(t, [0, 1], [1.04, 1.08]);
  const kenBurnsX = interpolate(t, [0, 1], [-6, 6]);

  // === Dragon flight — across the sky on a long cycle ===
  const dragonStart = 30;
  const dragonEnd = 200;
  const dragonProgress = interpolate(
    frame,
    [dragonStart, dragonEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const dragonX = interpolate(dragonProgress, [0, 1], [width + 80, -160]);
  const dragonY = interpolate(dragonProgress, [0, 0.5, 1], [60, 90, 70]);
  const dragonRot = interpolate(dragonProgress, [0, 0.5, 1], [-4, 0, -4]);

  // === Fireflies — array of pulsing dots ===
  const fireflies = Array.from({ length: 12 }).map((_, i) => {
    const seed = i * 1.234;
    const baseX = (i / 12) * width + Math.sin(frame / 30 + seed) * 18;
    const baseY = height * 0.55 + Math.cos(frame / 40 + seed) * 22;
    const pulse = (Math.sin(frame / 20 + seed) + 1) / 2;
    return { x: baseX, y: baseY, opacity: 0.3 + pulse * 0.7 };
  });

  // === Embers drifting up ===
  const embers = Array.from({ length: 8 }).map((_, i) => {
    const cycle = (frame + i * 30) % 240;
    const progress = cycle / 240;
    const x = (i / 8) * width + Math.sin(progress * Math.PI * 4) * 12;
    const y = height - progress * (height * 0.7);
    const opacity = interpolate(progress, [0, 0.1, 0.85, 1], [0, 1, 0.6, 0]);
    return { x, y, opacity };
  });

  return (
    <AbsoluteFill style={{ background: '#0d0a06', overflow: 'hidden' }}>
      {/* Castle base — Ken Burns */}
      <AbsoluteFill
        style={{
          transform: `scale(${kenBurnsScale}) translateX(${kenBurnsX}px)`,
          transformOrigin: 'center 40%',
        }}
      >
        <Img
          src={CASTLE_SRC}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 30%',
            filter: 'saturate(1.12) contrast(1.06)',
          }}
        />
      </AbsoluteFill>

      {/* Dragon */}
      <Sequence from={dragonStart} durationInFrames={dragonEnd - dragonStart + 30}>
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: dragonX,
              top: dragonY,
              width: 90,
              height: 90,
              transform: `rotate(${dragonRot}deg)`,
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.7))',
            }}
          >
            <Img
              src={DRAGON_SRC}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                mixBlendMode: 'multiply',
              }}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Fireflies */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {fireflies.map((f, i) => (
          <div
            key={`ff-${i}`}
            style={{
              position: 'absolute',
              left: f.x,
              top: f.y,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#fff8c0',
              boxShadow: '0 0 8px rgba(255, 220, 120, 0.9), 0 0 16px rgba(255, 180, 60, 0.6)',
              opacity: f.opacity,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Embers */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {embers.map((e, i) => (
          <div
            key={`em-${i}`}
            style={{
              position: 'absolute',
              left: e.x,
              top: e.y,
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: '#ff8a3a',
              boxShadow: '0 0 6px rgba(255, 130, 40, 0.9)',
              opacity: e.opacity,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Sunset vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(20, 5, 0, 0.35) 100%), ' +
            'linear-gradient(180deg, rgba(255, 120, 30, 0.06) 0%, transparent 30%, rgba(20, 5, 0, 0.25) 100%)',
          pointerEvents: 'none',
        }}
      />

    </AbsoluteFill>
  );
};
