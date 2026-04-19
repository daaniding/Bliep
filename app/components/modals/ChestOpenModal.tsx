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
}

function rollRewards(kind: ChestKind): Reward[] {
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pool: Reward[] = [];
  if (kind === 'wood') {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(40, 90), color: '#F5C842' });
    if (Math.random() < 0.35) {
      pool.push({ id: 'speed', icon: '⚡', label: 'Bouw-versneller', amount: 1, color: '#6fd4f0' });
    }
  } else if (kind === 'silver') {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(120, 260), color: '#F5C842' });
    pool.push({ id: 'speed', icon: '⚡', label: 'Bouw-versneller', amount: rand(1, 2), color: '#6fd4f0' });
    if (Math.random() < 0.4) {
      pool.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(2, 5), color: '#b080e0' });
    }
  } else {
    pool.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(350, 600), color: '#F5C842' });
    pool.push({ id: 'speed', icon: '⚡', label: 'Bouw-versneller', amount: rand(2, 4), color: '#6fd4f0' });
    pool.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(6, 12), color: '#b080e0' });
    if (Math.random() < 0.5) {
      pool.push({ id: 'gems', icon: '💎', label: 'Gems', amount: rand(2, 8), color: '#6fd4f0' });
    }
  }
  return pool;
}

function chestPalette(kind: ChestKind) {
  if (kind === 'wood')   return { body: '#7a4320', lid: '#c98c1a', gold: '#F5C842', label: 'HOUTEN KIST' };
  if (kind === 'silver') return { body: '#4a5a6a', lid: '#9aaab8', gold: '#d0dae4', label: 'ZILVEREN KIST' };
  return { body: '#C8882A', lid: '#F5C842', gold: '#ffe07a', label: 'GOUDEN KIST' };
}

type Phase = 'idle' | 'shake' | 'burst' | 'reveal' | 'done';

export default function ChestOpenModal({ open, onClose, kind }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimed, setClaimed] = useState(false);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const palette = useMemo(() => chestPalette(kind), [kind]);

  // Reset state when modal opens
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
    await wait(900);
    sfxClaim();
    setPhase('burst');
    const drops = rollRewards(kind);
    setRewards(drops);
    await wait(450);
    setPhase('reveal');
    await wait(300 + drops.length * 260);
    setPhase('done');
  }

  function claim() {
    if (claimed) return;
    sfxClaim();
    for (const r of rewards) {
      if (r.id === 'coins') award(r.amount);
      if (r.id === 'trophies') awardTrophies(r.amount, `Kist geopend (${kind})`);
      if (r.id === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
      // gems: placeholder (no live state yet)
    }
    setClaimed(true);
    window.setTimeout(onClose, 520);
  }

  return (
    <BHModal open={open} onClose={onClose} title={palette.label} subtitle={phase === 'idle' ? 'Tik om te openen' : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 320 }}>
        {/* Chest stage */}
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 180,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {/* glow burst */}
          <AnimatePresence>
            {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
              <motion.div
                initial={{ scale: 0.2, opacity: 0.9 }}
                animate={{ scale: 3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at center, ${palette.gold} 0%, ${palette.gold}88 25%, transparent 60%)`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>

          {/* Chest */}
          <motion.button
            onClick={openChest}
            disabled={phase !== 'idle'}
            aria-label="Open kist"
            animate={
              phase === 'shake'
                ? { rotate: [0, -8, 8, -6, 6, -3, 3, 0], scale: [1, 1.05, 1] }
                : phase === 'burst'
                  ? { scale: 1.15, rotate: 0 }
                  : { scale: 1, rotate: 0 }
            }
            transition={
              phase === 'shake'
                ? { duration: 0.9, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 300, damping: 18 }
            }
            whileHover={phase === 'idle' ? { y: -4 } : undefined}
            style={{
              background: 'transparent', border: 'none',
              cursor: phase === 'idle' ? 'pointer' : 'default',
              position: 'relative', zIndex: 2,
              padding: 0,
            }}
          >
            <svg width="140" height="120" viewBox="0 0 42 38" fill="none">
              {/* body */}
              <path d="M3 14 L39 14 L39 34 L3 34 Z" fill={palette.body} stroke="#1A0A02" strokeWidth="1.5" />
              {/* lid — lifts on burst */}
              <motion.g
                animate={
                  phase === 'burst' || phase === 'reveal' || phase === 'done'
                    ? { y: -12, rotate: -18 }
                    : { y: 0, rotate: 0 }
                }
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                style={{ transformOrigin: '3px 14px' }}
              >
                <path d="M3 14 Q3 6 11 6 L31 6 Q39 6 39 14" fill={palette.lid} stroke="#1A0A02" strokeWidth="1.5" />
              </motion.g>
              <rect x="3" y="18" width="36" height="3" fill={palette.gold} stroke="#1A0A02" strokeWidth=".8" />
              <rect x="17" y="14" width="8" height="12" fill={palette.gold} stroke="#1A0A02" strokeWidth=".8" />
              <circle cx="21" cy="21" r="1.4" fill="#1A0A02" />
            </svg>
          </motion.button>

          {/* sparkles during burst */}
          {(phase === 'burst' || phase === 'reveal') && (
            <>
              {Array.from({ length: 14 }).map((_, i) => {
                const angle = (i / 14) * Math.PI * 2;
                const dist = 60 + Math.random() * 40;
                return (
                  <motion.span
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist - 20,
                      opacity: 0,
                      scale: 1.2,
                    }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: Math.random() * 0.15 }}
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      fontSize: 18, pointerEvents: 'none',
                    }}
                  >
                    {['✨', '⭐', '💫'][i % 3]}
                  </motion.span>
                );
              })}
            </>
          )}
        </div>

        {/* Rewards reveal */}
        <AnimatePresence>
          {phase === 'reveal' || phase === 'done' ? (
            <motion.div
              key="rewards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${Math.min(rewards.length, 4)}, 1fr)`, gap: 8 }}
            >
              {rewards.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ y: 20, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20, delay: i * 0.22 }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 10,
                    background: 'rgba(42,22,8,0.12)',
                    boxShadow: `inset 0 0 0 1.5px ${r.color}aa, inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 14px ${r.color}55`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 28 }}>{r.icon}</div>
                  <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 16, color: '#2a1608', lineHeight: 1 }}>
                    +{r.amount}
                  </div>
                  <div style={{ fontFamily: philosopher, fontSize: 10, color: '#5a3a22', letterSpacing: '0.04em', marginTop: 2 }}>
                    {r.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            phase === 'idle' && (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  fontFamily: philosopher, fontStyle: 'italic', fontSize: 12, color: '#5a3a22', textAlign: 'center',
                }}
              >
                Tik op de kist om te openen
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Claim button */}
        {phase === 'done' && (
          <motion.button
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.1 }}
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
      </div>
    </BHModal>
  );
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
