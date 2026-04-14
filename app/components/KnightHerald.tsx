'use client';

import { useEffect, useState } from 'react';

const LINES = [
  'Sire, een nieuwe dag wacht!',
  'De koning vraagt om uw aandacht.',
  'Een opdracht ligt klaar...',
  'Het rijk heeft u nodig, sire.',
  'Vandaag verdienen we trofeeën!',
  'Zal ik de kist voor u openen?',
];

interface Props {
  chosenTaskTitle?: string | null;
  taskDone?: boolean;
}

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
      ? `Vandaag: ${chosenTaskTitle}`
      : LINES[lineIdx];

  return (
    <div
      className="absolute pointer-events-none flex items-end gap-2"
      style={{
        bottom: 230,
        left: 6,
        zIndex: 15,
        animation: 'fadeUp 0.8s ease-out 0.4s both',
      }}
    >
      {/* Knight portrait — gold-rimmed circle */}
      <div
        className="knight-bob"
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3.5px solid #f0b840',
          boxShadow:
            'inset 0 0 0 1.5px #0d0a06, ' +
            '0 5px 12px rgba(0, 0, 0, 0.7), ' +
            '0 0 22px rgba(240, 184, 64, 0.45)',
          background: '#0d0a06',
          flexShrink: 0,
        }}
      >
        <img
          src="/assets/ui/knight.jpeg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 22%',
          }}
        />
      </div>

      {/* Speech parchment — clean parchment card with curl tail */}
      <div
        style={{
          position: 'relative',
          width: 180,
          marginBottom: 14,
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
          flexShrink: 0,
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
        {/* Tail pointing toward the knight */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -10,
            left: 16,
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
            left: 18,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '10px solid #f4e4b0',
          }}
        />
      </div>
    </div>
  );
}
