'use client';

import dynamic from 'next/dynamic';

// SSR-disabled wrapper around the 3D scene. R3F uses browser APIs
// (WebGL, requestAnimationFrame) that don't exist on the server.

const KingdomScene3D = dynamic(() => import('./KingdomScene3D'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(240, 184, 64, 0.28), transparent 60%), ' +
          'linear-gradient(180deg, #1a0a18 0%, #2a1505 50%, #0d0a06 100%)',
      }}
    >
      <p
        className="font-display"
        style={{
          fontSize: 12,
          color: '#fdd069',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textShadow: '0 1.5px 0 #0d0a06',
          opacity: 0.85,
        }}
      >
        Wereld laden...
      </p>
    </div>
  ),
});

export default function KingdomSceneClient() {
  return <KingdomScene3D />;
}
