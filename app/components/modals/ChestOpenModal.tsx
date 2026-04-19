'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BHModal from '../BHModal';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import { loadCity, saveCity, addSpeedTokens } from '@/lib/cityStore';
import { addResources, RESOURCE_META, type ResourceKey } from '@/lib/resources';
import { sfxClaim, sfxTap } from '@/lib/sound';

type ChestKind = 'wood' | 'silver' | 'gold';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: ChestKind;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface Reward {
  id: string;
  icon: string;
  label: string;
  amount: number;
  color: string;
  rarity: Rarity;
  // When applying to stores
  apply: 'coins' | 'trophies' | 'speed' | ResourceKey;
}

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(p: number) { return Math.random() < p; }

function rarityColor(r: Rarity): string {
  if (r === 'legendary') return '#ffb84a';
  if (r === 'epic')      return '#b080e0';
  if (r === 'rare')      return '#6fd4f0';
  return '#F5C842';
}

function resReward(key: ResourceKey, amount: number): Reward {
  const m = RESOURCE_META[key];
  return { id: key, icon: m.icon, label: m.label, amount, color: m.color, rarity: m.rarity, apply: key };
}

function rollRewards(kind: ChestKind): Reward[] {
  const out: Reward[] = [];
  if (kind === 'wood') {
    out.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(50, 110), color: '#F5C842', rarity: 'common', apply: 'coins' });
    out.push(resReward('wood', rand(2, 5)));
    if (chance(0.55)) out.push(resReward('stone', rand(1, 3)));
    if (chance(0.3))  out.push({ id: 'speed', icon: '⚡', label: 'Versneller', amount: 1, color: '#6fd4f0', rarity: 'rare', apply: 'speed' });
    if (chance(0.15)) out.push(resReward('shards', rand(1, 2)));
  } else if (kind === 'silver') {
    out.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(160, 320), color: '#F5C842', rarity: 'common', apply: 'coins' });
    out.push({ id: 'speed', icon: '⚡', label: 'Versneller', amount: rand(1, 2), color: '#6fd4f0', rarity: 'rare', apply: 'speed' });
    out.push(resReward('iron', rand(1, 3)));
    if (chance(0.6))  out.push(resReward('scrolls', 1));
    if (chance(0.45)) out.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(3, 7), color: '#b080e0', rarity: 'epic', apply: 'trophies' });
    if (chance(0.3))  out.push(resReward('magicDust', rand(1, 2)));
    if (chance(0.2))  out.push(resReward('keys', 1));
  } else {
    out.push({ id: 'coins', icon: '🪙', label: 'Coins', amount: rand(420, 780), color: '#F5C842', rarity: 'common', apply: 'coins' });
    out.push({ id: 'speed', icon: '⚡', label: 'Versneller', amount: rand(2, 4), color: '#6fd4f0', rarity: 'rare', apply: 'speed' });
    out.push({ id: 'trophies', icon: '🏆', label: 'Trofeeën', amount: rand(7, 15), color: '#b080e0', rarity: 'epic', apply: 'trophies' });
    out.push(resReward('gems', rand(4, 12)));
    if (chance(0.7))  out.push(resReward('potions', 1));
    if (chance(0.5))  out.push(resReward('keys', rand(1, 2)));
    if (chance(0.25)) out.push(resReward('banners', 1));
  }
  return out;
}

const CHEST_SKIN: Record<ChestKind, { label: string; filter: string; glow: string; accent: string }> = {
  wood:   { label: 'HOUTEN KIST',   filter: 'saturate(0.55) brightness(0.95) hue-rotate(-14deg)', glow: '#c98c1a', accent: '#7a4320' },
  silver: { label: 'ZILVEREN KIST', filter: 'grayscale(0.95) brightness(1.08) contrast(1.02)',    glow: '#d0dae4', accent: '#9aaab8' },
  gold:   { label: 'GOUDEN KIST',   filter: 'saturate(1.2) brightness(1.06)',                     glow: '#ffe07a', accent: '#F5C842' },
};

type Phase = 'idle' | 'anticipation' | 'shake' | 'burst' | 'reveal' | 'done';

export default function ChestOpenModal({ open, onClose, kind }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [revealedIdx, setRevealedIdx] = useState(0); // how many revealed so far
  const [epicSplashIdx, setEpicSplashIdx] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const skin = CHEST_SKIN[kind];
  const glow = skin.glow;
  const accent = skin.accent;
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setRewards([]);
    setRevealedIdx(0);
    setEpicSplashIdx(null);
    setClaimed(false);
  }, [open]);

  async function openChest() {
    if (phase !== 'idle') return;
    sfxTap();
    setPhase('anticipation');
    await wait(480);
    if (!aliveRef.current) return;
    setPhase('shake');
    await wait(1100);
    if (!aliveRef.current) return;
    sfxClaim();
    setPhase('burst');
    const drops = rollRewards(kind);
    setRewards(drops);
    await wait(800);
    if (!aliveRef.current) return;
    setPhase('reveal');
    await autoReveal(drops);
  }

  async function autoReveal(drops: Reward[]) {
    for (let i = 0; i < drops.length; i++) {
      if (!aliveRef.current) return;
      setRevealedIdx(i + 1);
      const r = drops[i];
      if (r.rarity === 'epic' || r.rarity === 'legendary') {
        sfxClaim();
        setEpicSplashIdx(i);
        await wait(520);
        if (!aliveRef.current) return;
        setEpicSplashIdx(null);
      }
      await wait(380);
    }
    if (!aliveRef.current) return;
    setPhase('done');
  }

  // Tap speeds up: if user taps during reveal, show all at once
  function skipReveal() {
    if (phase !== 'reveal' || rewards.length === 0) return;
    setRevealedIdx(rewards.length);
    setEpicSplashIdx(null);
    setPhase('done');
  }

  function claim() {
    if (claimed) return;
    sfxClaim();
    const bulkRes: Partial<Record<ResourceKey, number>> = {};
    for (const r of rewards) {
      if (r.apply === 'coins') award(r.amount);
      else if (r.apply === 'trophies') awardTrophies(r.amount, `Kist (${kind})`);
      else if (r.apply === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
      else bulkRes[r.apply] = (bulkRes[r.apply] ?? 0) + r.amount;
    }
    if (Object.keys(bulkRes).length) addResources(bulkRes);
    setClaimed(true);
    window.setTimeout(onClose, 520);
  }

  // Screen-shake wrapper variants
  const shakeVariants = useMemo(() => ({
    idle:         { x: 0, y: 0, scale: 1 },
    anticipation: { x: 0, y: 0, scale: 0.98 },
    shake:        { x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0], y: [0, -4, 3, -3, 3, -1, 0], scale: 1, transition: { duration: 1.1, ease: 'easeInOut' as const } },
    burst:        { x: [0, -14, 14, -8, 0], y: [0, -10, 4, 0], scale: [1, 1.04, 1], transition: { duration: 0.5, ease: 'easeOut' as const } },
    reveal:       { x: 0, y: 0, scale: 1 },
    done:         { x: 0, y: 0, scale: 1 },
  }), []);

  const currentEpic = epicSplashIdx !== null ? rewards[epicSplashIdx] : null;

  return (
    <BHModal open={open} onClose={onClose} title={skin.label} accent={accent}>
      <motion.div
        animate={phase}
        variants={shakeVariants}
        onClick={skipReveal}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 360, cursor: phase === 'reveal' ? 'pointer' : 'default' }}
      >
        {/* ============= CHEST STAGE ============= */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 220,
            display: 'grid',
            placeItems: 'center',
            overflow: 'visible',
          }}
        >
          {/* continuous gold particle rain (from burst onward) */}
          {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
            <>
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.span
                  key={`rain-${i}`}
                  initial={{ y: -40, x: (i - 6) * 22 + (Math.random() * 8 - 4), opacity: 0, rotate: 0 }}
                  animate={{ y: [-40, 200], opacity: [0, 1, 0], rotate: 360 }}
                  transition={{
                    duration: 2.4 + Math.random() * 1.2,
                    delay: Math.random() * 2,
                    repeat: Infinity,
                    ease: 'easeIn',
                  }}
                  style={{
                    position: 'absolute', left: '50%', top: 0,
                    fontSize: 10 + Math.random() * 6,
                    pointerEvents: 'none',
                    color: glow,
                    textShadow: `0 0 6px ${glow}`,
                    zIndex: 1,
                  }}
                >
                  {['✦', '✧', '•'][i % 3]}
                </motion.span>
              ))}
            </>
          )}

          {/* god-ray beams */}
          <AnimatePresence>
            {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{ opacity: [0.95, 0.7, 0.45, 0.3], scale: 2.4, rotate: 120 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `conic-gradient(from 0deg at 50% 50%,
                    ${glow}00 0deg,   ${glow}bb 10deg,  ${glow}00 22deg,
                    ${glow}00 40deg,  ${glow}99 52deg,  ${glow}00 64deg,
                    ${glow}00 80deg,  ${glow}bb 92deg,  ${glow}00 104deg,
                    ${glow}00 120deg, ${glow}99 132deg, ${glow}00 144deg,
                    ${glow}00 160deg, ${glow}bb 172deg, ${glow}00 184deg,
                    ${glow}00 200deg, ${glow}99 212deg, ${glow}00 224deg,
                    ${glow}00 240deg, ${glow}bb 252deg, ${glow}00 264deg,
                    ${glow}00 280deg, ${glow}99 292deg, ${glow}00 304deg,
                    ${glow}00 320deg, ${glow}bb 332deg, ${glow}00 344deg)`,
                  mixBlendMode: 'screen',
                  pointerEvents: 'none',
                  maskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 78%)',
                  WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 78%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* radial glow disk pulsing */}
          <AnimatePresence>
            {(phase === 'anticipation' || phase === 'shake' || phase === 'burst') && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{
                  scale: phase === 'burst' ? 3.4 : phase === 'shake' ? [0.9, 1.15, 1.05, 1.2, 1] : 0.8,
                  opacity: phase === 'burst' ? 0 : phase === 'shake' ? 0.55 : 0.3,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: phase === 'shake' ? 1.0 : 0.9, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at center, ${glow}dd 0%, ${glow}66 32%, transparent 66%)`,
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>

          {/* floor shadow */}
          <motion.div
            animate={{
              scale: phase === 'burst' ? 1.8 : phase === 'shake' ? [1, 0.9, 1.1, 0.95, 1] : phase === 'done' || phase === 'reveal' ? 1.5 : 1,
              opacity: phase === 'burst' ? 0.65 : 0.4,
            }}
            transition={{ duration: 0.9 }}
            style={{
              position: 'absolute', bottom: 28,
              width: 180, height: 26, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
              filter: 'blur(3px)',
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
                ? { y: [0, -5, 0], rotate: 0, scale: 1 }
                : phase === 'anticipation'
                  ? { y: 0, rotate: 0, scale: [1, 0.88, 1.04], filter: 'brightness(1.2)' }
                  : phase === 'shake'
                    ? { rotate: [0, -12, 12, -10, 10, -6, 6, -3, 3, 0], scale: [1, 1.08, 1.12, 1.08, 1.1, 1.05, 1], y: [0, -4, -6, -4, -2, 0] }
                    : phase === 'burst'
                      ? { rotate: 0, scale: [1, 1.55, 1.35], y: [0, -28, -14], opacity: [1, 1, 0.85] }
                      : { rotate: 0, scale: 0.85, y: 8, opacity: 0.55 }
            }
            transition={
              phase === 'idle'
                ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                : phase === 'anticipation'
                  ? { duration: 0.45, ease: 'easeOut' }
                  : phase === 'shake'
                    ? { duration: 1.08, ease: 'easeInOut' }
                    : phase === 'burst'
                      ? { duration: 0.8, ease: 'easeOut' }
                      : { type: 'spring', stiffness: 240, damping: 22 }
            }
            whileHover={phase === 'idle' ? { scale: 1.05, y: -3 } : undefined}
            style={{
              position: 'relative', zIndex: 3,
              background: 'transparent', border: 'none', padding: 0,
              cursor: phase === 'idle' ? 'pointer' : 'default',
              filter: `drop-shadow(0 10px 16px rgba(0,0,0,0.6)) drop-shadow(0 0 22px ${glow}aa)`,
            }}
          >
            <img
              src="/assets/icons-rpg/kist.png"
              alt=""
              draggable={false}
              style={{
                width: 160,
                height: 'auto',
                display: 'block',
                filter: skin.filter,
                imageRendering: 'auto',
              }}
            />
          </motion.button>

          {/* burst sparkles (spiral explosion) */}
          {(phase === 'burst' || phase === 'reveal') && (
            <>
              {Array.from({ length: 22 }).map((_, i) => {
                const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
                const dist = 100 + Math.random() * 110;
                const sz = 14 + Math.random() * 16;
                return (
                  <motion.span
                    key={`burst-${i}`}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.3, rotate: 0 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist - 18,
                      opacity: [1, 1, 0],
                      scale: [0.3, 1.4, 0.9],
                      rotate: 720,
                    }}
                    transition={{ duration: 1.4, ease: 'easeOut', delay: Math.random() * 0.25 }}
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      fontSize: sz,
                      pointerEvents: 'none',
                      textShadow: `0 0 10px ${glow}`,
                      zIndex: 4,
                    }}
                  >
                    {['✨', '⭐', '💫', '✦', '✧'][i % 5]}
                  </motion.span>
                );
              })}
            </>
          )}

          {/* fullscreen white flash on burst */}
          <AnimatePresence>
            {phase === 'burst' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.95, 0.4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, times: [0, 0.2, 0.55, 1], ease: 'easeOut' }}
                style={{
                  position: 'fixed', inset: 0,
                  background: `radial-gradient(circle at center, #fff6d0 0%, ${glow}cc 35%, transparent 80%)`,
                  pointerEvents: 'none',
                  zIndex: 2147483647,
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ============= REVEAL CARDS ============= */}
        <div style={{ width: '100%', minHeight: 92 }}>
          {phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontFamily: philosopher, fontStyle: 'italic', fontSize: 13, color: '#5a3a22', textAlign: 'center' }}
            >
              Tik op de kist om te openen
            </motion.div>
          )}
          {phase === 'anticipation' && (
            <div style={{ fontFamily: cinzel, fontSize: 12, color: '#8a2a1a', textAlign: 'center', letterSpacing: '0.2em' }}>
              …ZE OPENT…
            </div>
          )}
          {phase === 'shake' && (
            <div style={{ fontFamily: cinzel, fontSize: 13, color: '#3a2108', textAlign: 'center', letterSpacing: '0.15em' }}>
              ⚡ HET SLOT BREEKT ⚡
            </div>
          )}
          {(phase === 'reveal' || phase === 'done') && rewards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rewards.length, 4)}, 1fr)`, gap: 8 }}>
              {rewards.map((r, i) => (
                <RewardCard
                  key={r.id + i}
                  r={r}
                  visible={i < revealedIdx}
                  index={i}
                />
              ))}
            </div>
          )}
          {phase === 'reveal' && (
            <div style={{ marginTop: 6, fontFamily: philosopher, fontStyle: 'italic', fontSize: 10, color: '#5a3a22', textAlign: 'center', opacity: 0.7 }}>
              Tik om over te slaan
            </div>
          )}
        </div>

        {/* ============= EPIC SPLASH (per rare/epic/legendary card) ============= */}
        <AnimatePresence>
          {currentEpic && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                position: 'fixed', inset: 0,
                display: 'grid', placeItems: 'center',
                zIndex: 2147483647,
                pointerEvents: 'none',
                background: `radial-gradient(circle at center, ${rarityColor(currentEpic.rarity)}55 0%, rgba(0,0,0,0.75) 70%)`,
              }}
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  fontFamily: cinzel, fontWeight: 900, fontSize: 14,
                  letterSpacing: '0.3em',
                  color: rarityColor(currentEpic.rarity),
                  textShadow: `0 0 12px ${rarityColor(currentEpic.rarity)}`,
                }}>
                  {currentEpic.rarity.toUpperCase()}
                </div>
                <div style={{ fontSize: 120, filter: `drop-shadow(0 0 30px ${rarityColor(currentEpic.rarity)})` }}>
                  {currentEpic.icon}
                </div>
                <div style={{
                  fontFamily: cinzel, fontWeight: 900, fontSize: 32, color: '#fff6d0',
                  textShadow: `0 2px 0 #000, 0 0 20px ${rarityColor(currentEpic.rarity)}`,
                }}>
                  +{currentEpic.amount} {currentEpic.label}
                </div>
              </motion.div>
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
            onClick={(e) => { e.stopPropagation(); claim(); }}
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

function RewardCard({ r, visible, index }: { r: Reward; visible: boolean; index: number }) {
  const rc = rarityColor(r.rarity);
  const premium = r.rarity !== 'common';
  return (
    <motion.div
      initial={{ y: -80, opacity: 0, scale: 0.5, rotate: -20 + index * 10 }}
      animate={visible
        ? { y: 0, opacity: 1, scale: 1, rotate: 0 }
        : { y: -80, opacity: 0, scale: 0.5, rotate: -20 + index * 10 }}
      transition={{ type: 'spring', stiffness: 340, damping: 18 }}
      style={{
        position: 'relative',
        padding: '10px 4px 8px',
        borderRadius: 10,
        background: `linear-gradient(180deg, ${rc}30 0%, ${rc}0f 100%)`,
        boxShadow: `inset 0 0 0 1.5px ${rc}cc, inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px ${rc}66`,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {premium && visible && (
        <motion.div
          initial={{ x: '-130%' }}
          animate={{ x: '130%' }}
          transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3, repeat: Infinity, repeatDelay: 1.8 }}
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(100deg, transparent 40%, ${rc}99 50%, transparent 60%)`,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      )}
      <motion.div
        animate={visible ? { y: [0, -2.5, 0] } : {}}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
        style={{ fontSize: 30, lineHeight: 1, filter: `drop-shadow(0 2px 6px ${rc}bb)` }}
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
