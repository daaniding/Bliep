'use client';

import { Player } from '@remotion/player';
import { HeroScene } from '@/app/remotion/HeroScene';

// Remotion <Player> embeds the HeroScene composition. Loops forever,
// no controls, fills the parent. Frame-perfect knight bob, dragon
// flight, fireflies, embers, ken-burns castle.

export default function HeroPlayer() {
  return (
    <Player
      component={HeroScene}
      durationInFrames={240}
      compositionWidth={390}
      compositionHeight={520}
      fps={30}
      loop
      autoPlay
      controls={false}
      clickToPlay={false}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
      }}
    />
  );
}
