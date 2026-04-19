'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import BHModal from '../BHModal';
import { sfxClaim } from '@/lib/sound';

interface Props {
  open: boolean;
  onClose: () => void;
  newLevel: number;
  chestKind: 'wood' | 'bronze' | 'gold' | 'magic';
  onClaim: () => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

const CHEST_META: Record<Props['chestKind'], { label: string; color: string; glow: string }> = {
  wood: { label: 'Houten kist', color: '#9c6838', glow: 'rgba(156,104,56,0.55)' },
  bronze: { label: 'Bronzen kist', color: '#c98a3d', glow: 'rgba(201,138,61,0.6)' },
  gold: { label: 'Gouden kist', color: '#fdd069', glow: 'rgba(253,208,105,0.7)' },
  magic: { label: 'Magische kist', color: '#b080e0', glow: 'rgba(176,128,224,0.7)' },
};

export default function LevelUpModal({ open, onClose, newLevel, chestKind, onClaim }: Props) {
  const meta = CHEST_META[chestKind];

  useEffect(() => {
    if (open) sfxClaim();
  }, [open]);

  // Pre-computed sparkle positions so they don't jitter on re-render.
  const sparkles = useMemo(() => (
    Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      x: Math.cos((i / 14) * Math.PI * 2) * (80 + (i % 3) * 18),
      y: Math.sin((i / 14) * Math.PI * 2) * (80 + (i % 3) * 18),
      delay: (i * 0.06) + 0.15,
      size: 8 + (i % 4) * 3,
    }))
  ), []);

  return (
    <BHModal open={open} onClose={onClose} title="" accent="#fdd069">
      <div
        className="relative flex flex-col items-center text-center"
        style={{
          padding: '18px 10px 8px',
          minHeight: 360,
        }}
      >
        {/* Radial gold glow behind content */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, rgba(253,208,105,0.35) 0%, rgba(253,208,105,0.08) 40%, transparent 70%)',
          }}
        />

        {/* Sparkles */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {sparkles.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0.6, 0], scale: [0, 1.4, 1, 0.4], x: s.x, y: s.y }}
              transition={{ duration: 1.8, delay: s.delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.4 }}
              className="absolute"
              style={{
                left: '50%',
                top: '38%',
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #fff6dc 0%, #fdd069 50%, transparent 70%)',
                boxShadow: '0 0 12px rgba(253,208,105,0.85)',
              }}
            />
          ))}
        </div>

        {/* "LEVEL UP" banner */}
        <motion.div
          initial={{ y: -12, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.05 }}
          className="relative z-10"
          style={{
            fontFamily: cinzel,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: '#fff6dc',
            textShadow: '0 2px 0 #0d0a06, 0 0 18px rgba(253,208,105,0.65)',
          }}
        >
          LEVEL UP
        </motion.div>

        {/* Big level badge */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.15 }}
          className="relative z-10 mt-3"
          style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 34% 28%, #fff6dc 0%, #fdd069 30%, #d19225 65%, #a3701a 100%)',
            border: '5px solid #0d0a06',
            boxShadow:
              'inset 0 6px 0 rgba(255,255,255,0.45), ' +
              'inset 0 -8px 0 rgba(0,0,0,0.22), ' +
              '0 6px 0 #6e4c10, 0 14px 28px rgba(0,0,0,0.65), ' +
              '0 0 48px rgba(253,208,105,0.5)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            className="font-display tabular-nums"
            style={{
              fontSize: 68,
              lineHeight: 1,
              color: '#2a1a06',
              textShadow: '0 2px 0 rgba(255,255,255,0.55), 0 -1px 0 rgba(0,0,0,0.2)',
            }}
          >
            {newLevel}
          </div>
        </motion.div>

        {/* "Je bent nu level N" */}
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="relative z-10 mt-4"
          style={{
            fontFamily: philosopher,
            fontSize: 15,
            fontStyle: 'italic',
            color: '#e0c890',
            letterSpacing: '0.02em',
          }}
        >
          Je koninkrijk wint aan kracht.
        </motion.div>

        {/* Chest reward card */}
        <motion.button
          type="button"
          onClick={onClaim}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 320, damping: 22 }}
          whileTap={{ scale: 0.97 }}
          className="relative z-10 mt-5 w-full flex items-center gap-3 text-left active:translate-y-[2px]"
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: '3px solid #0d0a06',
            background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
            boxShadow:
              `inset 0 2px 0 rgba(255,230,160,0.28), ` +
              `0 4px 0 #0d0a06, 0 8px 18px rgba(0,0,0,0.5), ` +
              `0 0 26px ${meta.glow}`,
            cursor: 'pointer',
          }}
        >
          {/* Chest icon */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: `radial-gradient(circle at 35% 28%, #fff6dc 0%, ${meta.color} 40%, #2a1a06 100%)`,
              border: '2.5px solid #0d0a06',
              boxShadow: `inset 0 2px 0 rgba(255,255,255,0.35), 0 0 14px ${meta.glow}`,
              fontSize: 32,
              lineHeight: 1,
            }}
          >
            📦
          </div>
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: cinzel,
                fontSize: 11,
                letterSpacing: '0.18em',
                fontWeight: 700,
                color: '#b69560',
                textTransform: 'uppercase',
              }}
            >
              Beloning
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 18,
                color: '#fdd069',
                textShadow: '0 1px 0 #0d0a06',
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {meta.label}
            </div>
          </div>
          <div
            className="font-display flex items-center justify-center"
            style={{
              minWidth: 78,
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 14,
              color: '#0d0a06',
              background: 'linear-gradient(180deg, #ffe58a 0%, #fdd069 50%, #a3701a 100%)',
              border: '2.5px solid #0d0a06',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), 0 3px 0 #6e4c10',
              textShadow: '0 1px 0 rgba(255,255,255,0.45)',
              letterSpacing: '0.04em',
            }}
          >
            CLAIM
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="relative z-10 mt-3"
          style={{
            fontFamily: philosopher,
            fontSize: 12,
            color: '#8a7655',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            letterSpacing: '0.04em',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Later openen
        </motion.button>
      </div>
    </BHModal>
  );
}
