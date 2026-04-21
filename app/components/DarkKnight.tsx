'use client';

import { useEffect, useRef, useState } from 'react';

interface DarkKnightProps {
  isAttacking: boolean;
  onAttackComplete: () => void;
  onHammerImpact: () => void;
}

const SHEET = '/assets/defenders/knight/spritesheet.png';
const COLS = 6;
const ROWS = 24;
const IDLE_ROW = 0;
const ATTACK_ROW = 23;
const IMPACT_FRAME = 3;
const LAST_FRAME = 5;

const pctX = (col: number) => `${(col / (COLS - 1)) * 100}%`;
const pctY = (row: number) => `${(row / (ROWS - 1)) * 100}%`;

export default function DarkKnight({ isAttacking, onAttackComplete, onHammerImpact }: DarkKnightProps) {
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(IDLE_ROW);

  const impactRef = useRef(onHammerImpact);
  const completeRef = useRef(onAttackComplete);
  useEffect(() => { impactRef.current = onHammerImpact; }, [onHammerImpact]);
  useEffect(() => { completeRef.current = onAttackComplete; }, [onAttackComplete]);

  useEffect(() => {
    if (isAttacking) {
      setRow(ATTACK_ROW);
      setCol(0);
      let frame = 0;
      const id = window.setInterval(() => {
        frame += 1;
        if (frame > LAST_FRAME) {
          window.clearInterval(id);
          completeRef.current();
          return;
        }
        setCol(frame);
        if (frame === IMPACT_FRAME) impactRef.current();
      }, 80);
      return () => window.clearInterval(id);
    }

    setRow(IDLE_ROW);
    setCol(0);
    let frame = 0;
    const id = window.setInterval(() => {
      frame = (frame + 1) % COLS;
      setCol(frame);
    }, 200);
    return () => window.clearInterval(id);
  }, [isAttacking]);

  return (
    <div
      aria-hidden
      style={{
        width: 192,
        height: 192,
        backgroundImage: `url(${SHEET})`,
        backgroundSize: '600% 2400%',
        backgroundPosition: `${pctX(col)} ${pctY(row)}`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    />
  );
}
