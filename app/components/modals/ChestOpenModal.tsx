'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BHModal from '../BHModal';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { loadCity, saveCity, addSpeedTokens } from '@/lib/cityStore';
import { sfxClaim, sfxTap } from '@/lib/sound';

type ChestKind = 'wood' | 'silver' | 'gold';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: ChestKind;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

interface Reward {
  id: string;
  icon: string;
  label: string;
  amount: number;
  color: string;
  rarity: 'common' | 'rare' | 'epic';
}

function rollRewards(kind: ChestKind): Reward[] {
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pool: Reward[] = [];
  if (kind === 'wood') {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(40, 90), color: '#F5C842', rarity: 'common' });
    if (Math.random() < 0.4) pool.push({ id: 'speed', icon: '⚡', label: 'Bouwversneller', amount: 1, color: '#6fd4f0', rarity: 'rare' });
  } else if (kind === 'silver') {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(140, 280), color: '#F5C842', rarity: 'common' });
    pool.push({ id: 'speed', icon: '⚡', label: 'Bouwversneller', amount: rand(1, 2), color: '#6fd4f0', rarity: 'rare' });
    if (Math.random() < 0.5) pool.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(2, 6), color: '#b080e0', rarity: 'epic' });
  } else {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(380, 700), color: '#F5C842', rarity: 'common' });
    pool.push({ id: 'speed', icon: '⚡', label: 'Bouwversneller', amount: rand(2, 4), color: '#6fd4f0', rarity: 'rare' });
    pool.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(6, 14), color: '#b080e0', rarity: 'epic' });
    if (Math.random() < 0.5) pool.push({ id: 'gems', icon: '💎', label: 'Edelstenen', amount: rand(3, 10), color: '#6fd4f0', rarity: 'epic' });
  }
  return pool;
}

const CHEST_SKIN: Record<ChestKind, { label: string; filter: string; glow: string; accent: string }> = {
  wood:   { label: 'HOUTEN KIST',   filter: 'saturate(0.55) brightness(0.95) hue-rotate(-14deg)', glow: '#c98c1a', accent: '#7a4320' },
  silver: { label: 'ZILVEREN KIST', filter: 'grayscale(0.95) brightness(1.08) contrast(1.02)',    glow: '#d0dae4', accent: '#9aaab8' },
  gold:   { label: 'GOUDEN KIST',   filter: 'saturate(1.15) brightness(1.04)',                    glow: '#ffe07a', accent: '#F5C842' },
};

type Phase = 'idle' | 'shake' | 'burst' | 'reveal' | 'done';

export default function ChestOpenModal({ open, onClose, kind }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimed, setClaimed] = useState(false);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const skin = CHEST_SKIN[kind];
  const glow = skin.glow;
  const accent = skin.accent;

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setRewards([]);
    setClaimed(false);
  }, [open]);

  async function openChest() {
    if (phase !== 'idle') return;
    sfxTap();
    setPhase('shake');
    await wait(950);
    sfxClaim();
    setPhase('burst');
    const drops = rollRewards(kind);
    setRewards(drops);
    await wait(700);
    setPhase('reveal');
    await wait(400 + drops.length * 280);
    setPhase('done');
  }

  function claim() {
    if (claimed) return;
    sfxClaim();
    for (const r of rewards) {
      if (r.id === 'coins') award(r.amount);
      if (r.id === 'trophies') awardTrophies(r.amount, `Kist (${kind})`);
      if (r.id === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
    }
    setClaimed(true);
    window.setTimeout(onClose, 520);
  }

  // Screen-shake wrapper variants
  const shakeVariants = useMemo(() => ({
    idle:  { x: 0, y: 0 },
    shake: { x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, -3, 2, -2, 2, 0], transition: { duration: 0.9, ease: 'easeInOut' as const } },
    burst: { x: [0, -12, 12, 0], y: [0, -8, 0], transition: { duration: 0.35, ease: 'easeOut' as const } },
    reveal: { x: 0, y: 0 },
    done: { x: 0, y: 0 },
  }), []);

  return (
    <BHModal open={open} onClose={onClose} title={skin.label} accent={accent}>
      <motion.div
        animate={phase}
        variants={shakeVariants}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 340 }}
      >
        {/* ============= CHEST STAGE ============= */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 200,
            display: 'grid',
            placeItems: 'center',
            overflow: 'visible',
          }}
        >
          {/* god-ray beams (during burst/reveal) */}
          <AnimatePresence>
            {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{ opacity: [0.9, 0.7, 0.4], scale: 2.2, rotate: 90 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `conic-gradient(from 0deg at 50% 50%,
                    ${glow}00 0deg,   ${glow}aa 12deg,  ${glow}00 24deg,
                    ${glow}00 45deg,  ${glow}88 57deg,  ${glow}00 69deg,
                    ${glow}00 90deg,  ${glow}aa 102deg, ${glow}00 114deg,
                    ${glow}00 135deg, ${glow}88 147deg, ${glow}00 159deg,
                    ${glow}00 180deg, ${glow}aa 192deg, ${glow}00 204deg,
                    ${glow}00 225deg, ${glow}88 237deg, ${glow}00 249deg,
                    ${glow}00 270deg, ${glow}aa 282deg, ${glow}00 294deg,
                    ${glow}00 315deg, ${glow}88 327deg, ${glow}00 339deg)`,
                  mixBlendMode: 'screen',
                  pointerEvents: 'none',
                  maskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 75%)',
                  WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 75%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* radial glow disk underneath */}
          <AnimatePresence>
            {phase !== 'idle' && (
              <motion.div
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: phase === 'shake' ? 1 : 3, opacity: phase === 'shake' ? 0.35 : 0 }}
                transition={{ duration: phase === 'shake' ? 0.9 : 1.1, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at center, ${glow}cc 0%, ${glow}55 30%, transparent 65%)`,
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>

          {/* floor shadow */}
          <motion.div
            animate={{
              scale: phase === 'burst' || phase === 'reveal' || phase === 'done' ? 1.4 : 1,
              opacity: phase === 'burst' ? 0.55 : 0.4,
            }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', bottom: 28,
              width: 180, height: 24, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)',
              filter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          />

          {/* chest image */}
          <motion.button
            onClick={openChest}
            disabled={phase !== 'idle'}
            aria-label="Open kist"
            animate={
              phase === 'idle'
                ? { y: [0, -4, 0], rotate: 0, scale: 1 }
                : phase === 'shake'
                  ? { rotate: [0, -10, 10, -8, 8, -4, 4, 0], scale: [1, 1.06, 1.09, 1.06, 1], y: [0, -2, -4, -2, 0] }
                  : phase === 'burst'
                    ? { rotate: 0, scale: [1, 1.4, 1.25], y: [0, -18, -8] }
                    : { rotate: 0, scale: 1, y: 0 }
            }
            transition={
              phase === 'idle'
                ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                : phase === 'shake'
                  ? { duration: 0.95, ease: 'easeInOut' }
                  : phase === 'burst'
                    ? { duration: 0.7, ease: 'easeOut' }
                    : { type: 'spring', stiffness: 240, damping: 20 }
            }
            whileHover={phase === 'idle' ? { scale: 1.04 } : undefined}
            style={{
              position: 'relative', zIndex: 3,
              background: 'transparent', border: 'none', padding: 0,
              cursor: phase === 'idle' ? 'pointer' : 'default',
              filter: `drop-shadow(0 10px 14px rgba(0,0,0,0.55)) drop-shadow(0 0 18px ${glow}88)`,
            }}
          >
            <img
              src="/assets/icons-rpg/kist.png"
              alt=""
              draggable={false}
              style={{
                width: 150,
                height: 'auto',
                display: 'block',
                filter: skin.filter,
                imageRendering: 'auto',
              }}
            />
          </motion.button>

          {/* burst sparkles */}
          {(phase === 'burst' || phase === 'reveal') && (
            <>
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
                const dist = 90 + Math.random() * 80;
                const sz = 12 + Math.random() * 14;
                return (
                  <motion.span
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist - 14,
                      opacity: [1, 1, 0],
                      scale: [0.4, 1.3, 0.8],
                      rotate: 360,
                    }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: Math.random() * 0.2 }}
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      fontSize: sz,
                      pointerEvents: 'none',
                      textShadow: `0 0 8px ${glow}`,
                      zIndex: 4,
                    }}
                  >
                    {['✨', '⭐', '💫', '✦'][i % 4]}
                  </motion.span>
                );
              })}
            </>
          )}

          {/* white screen flash */}
          <AnimatePresence>
            {phase === 'burst' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{
                  position: 'fixed', inset: 0,
                  background: `radial-gradient(circle at center, #fff6d0 0%, ${glow}aa 40%, transparent 80%)`,
                  pointerEvents: 'none',
                  zIndex: 2147483647,
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ============= REWARDS REVEAL ============= */}
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="hint"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 13, color: '#5a3a22', textAlign: 'center' }}
            >
              Tik op de kist om te openen
            </motion.div>
          )}
          {(phase === 'reveal' || phase === 'done') && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(rewards.length, 4)}, 1fr)`,
                gap: 8,
              }}
            >
              {rewards.map((r, i) => (
                <RewardCard key={r.id} r={r} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============= CLAIM BUTTON ============= */}
        {phase === 'done' && (
          <motion.button
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.15 }}
            whileTap={{ scale: 0.95 }}
            onClick={claim}
            disabled={claimed}
            style={{
              width: '100%',
              padding: '12px 14px', borderRadius: 12,
              border: 'none', cursor: claimed ? 'default' : 'pointer',
              background: claimed
                ? 'linear-gradient(180deg, #5a3a22, #2a1608)'
                : 'linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
              boxShadow: claimed
                ? 'inset 0 0 0 1.5px #1a0a02'
                : 'inset 0 0 0 1.5px #4a2a08, inset 0 0 0 2.5px rgba(255,240,150,.5), inset 0 2px 0 rgba(255,255,220,.55), 0 3px 0 rgba(0,0,0,.5)',
              color: claimed ? '#c9ac74' : '#3a2108',
              fontFamily: cinzel, fontWeight: 900, fontSize: 16, letterSpacing: '0.1em',
            }}
          >
            {claimed ? '✓ OPGEHAALD' : 'CLAIM'}
          </motion.button>
        )}
      </motion.div>
    </BHModal>
  );
}

function RewardCard({ r, index }: { r: Reward; index: number }) {
  // Each reward flies out of the chest on a little arc, lands in its grid cell
  const rarityColor = r.rarity === 'epic' ? '#b080e0' : r.rarity === 'rare' ? '#6fd4f0' : r.color;
  return (
    <motion.div
      initial={{ y: -120, x: (index - 1) * 10, opacity: 0, scale: 0.3, rotate: -25 + index * 15 }}
      animate={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
      transition={{
        type: 'spring', stiffness: 320, damping: 18,
        delay: 0.1 + index * 0.25,
      }}
      style={{
        position: 'relative',
        padding: '10px 4px 8px',
        borderRadius: 10,
        background: `linear-gradient(180deg, ${rarityColor}2c 0%, ${rarityColor}10 100%)`,
        boxShadow: `inset 0 0 0 1.5px ${rarityColor}bb, inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 14px ${rarityColor}55`,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* rarity shimmer sweep */}
      {r.rarity !== 'common' && (
        <motion.div
          initial={{ x: '-130%' }}
          animate={{ x: '130%' }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.4 + index * 0.25 }}
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(100deg, transparent 40%, ${rarityColor}88 50%, transparent 60%)`,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      )}
      <motion.div
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 }}
        style={{ fontSize: 28, lineHeight: 1, filter: `drop-shadow(0 2px 4px ${rarityColor}88)` }}
      >
        {r.icon}
      </motion.div>
      <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 17, color: '#2a1608', lineHeight: 1, marginTop: 3 }}>
        +{r.amount}
      </div>
      <div style={{ fontFamily: philosopher, fontSize: 9.5, color: '#5a3a22', letterSpacing: '0.04em', marginTop: 3, lineHeight: 1.1 }}>
        {r.label}
      </div>
    </motion.div>
  );
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
