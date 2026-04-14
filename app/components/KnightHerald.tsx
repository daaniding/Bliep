'use client';

import { useEffect, useState } from 'react';

const LINES = [
  'Sire, een nieuwe dag wacht!',
  'De koning vraagt om uw aandacht.',
  'Een opdracht ligt klaar...',
  'Het rijk heeft u nodig.',
  'Vandaag verdienen we trofeeën!',
];

interface Props {
  chosenTaskTitle?: string | null;
  taskDone?: boolean;
}

// Knight character standing on the bottom-left cliff. The sprite JPG
// has a white background, so we use an SVG <feColorMatrix> filter to
// chroma-key the white pixels to transparent. That makes the knight
// look like a real PNG cutout standing in the scene.

export default function KnightHerald({ chosenTaskTitle, taskDone }: Props) {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIdx(i => (i + 1) % LINES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const speech = taskDone
    ? 'Een glorieuze dag, sire!'
    : chosenTaskTitle
      ? chosenTaskTitle
      : LINES[lineIdx];

  return (
    <>
      {/* SVG defs holding the chroma-key filter — luminance threshold
          turns near-white pixels fully transparent. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="knightChromaKey" colorInterpolationFilters="sRGB">
            {/* Step 1: convert near-white to alpha 0 by subtracting
                a high-luminance threshold from the alpha channel. */}
            <feColorMatrix
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
               -1 -1 -1 0 2.6"
            />
            {/* Step 2: clean up edge fringe with a slight composite */}
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      </svg>

      {/* Knight sprite — chroma-keyed, drop-shadow for depth */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 220,
          left: 14,
          width: 110,
          height: 110,
          zIndex: 15,
          animation: 'fadeUp 0.8s ease-out 0.4s both, knightBob 3.2s ease-in-out infinite 1s',
        }}
      >
        <img
          src="/assets/ui/knight.jpeg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'url(#knightChromaKey) drop-shadow(0 6px 10px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 18px rgba(240, 184, 64, 0.35))',
          }}
        />
      </div>

      {/* Speech parchment — sits above the knight */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 320,
          left: 8,
          maxWidth: 200,
          padding: '10px 14px 11px 14px',
          background:
            'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.7), transparent 50%), ' +
            'linear-gradient(180deg, #fff6dc 0%, #f4e4b0 60%, #d6b67a 100%)',
          border: '2.5px solid #5c3a1e',
          borderRadius: 14,
          boxShadow:
            'inset 0 0 0 1.5px rgba(240,184,64,0.6), ' +
            'inset 0 2px 0 rgba(255,255,255,0.55), ' +
            '0 4px 10px rgba(0,0,0,0.6)',
          zIndex: 16,
          animation: 'fadeUp 0.8s ease-out 0.6s both',
        }}
      >
        <p
          className="font-body"
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.22,
            color: '#3a1f08',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {speech}
        </p>
        {/* Tail pointing toward the knight below */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -10,
            left: 28,
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '12px solid #5c3a1e',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -7,
            left: 30,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '10px solid #f4e4b0',
          }}
        />
      </div>
    </>
  );
}
