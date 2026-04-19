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

// Sprite sheet: 240x256, 5 cols × 8 rows, each frame 48×32.
// Each chest tier spans 2 rows = 10 frames: the first row (0-4) opens the
// chest, the second row (5-9) flips the lid off and the wood falls apart.
const SHEET_W = 240;
const SHEET_H = 256;
const FRAME_W = 48;
const FRAME_H = 32;
const COLS = 5;
const FRAME_COUNT = 10; // 2 rows × 5 cols per tier

const CHEST_SKIN: Record<ChestKind, { label: string; glow: string; accent: string; taps: number; baseRow: number }> = {
  wood:   { label: 'HOUTEN KIST',   glow: '#c98c1a', accent: '#7a4320', taps: 2, baseRow: 0 }, // rows 0-1 brown
  silver: { label: 'ZILVEREN KIST', glow: '#d0dae4', accent: '#9aaab8', taps: 3, baseRow: 6 }, // rows 6-7 blue/silver
  gold:   { label: 'GOUDEN KIST',   glow: '#ffe07a', accent: '#F5C842', taps: 4, baseRow: 4 }, // rows 4-5 red/gold
};

function chestSpriteStyle(baseRow: number, frame: number, scale: number): React.CSSProperties {
  const col = frame % COLS;
  const row = baseRow + Math.floor(frame / COLS);
  return {
    width: FRAME_W * scale,
    height: FRAME_H * scale,
    backgroundImage: 'url(/assets/chests/chests.png)',
    backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
    backgroundPosition: `-${col * FRAME_W * scale}px -${row * FRAME_H * scale}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    display: 'block',
  };
}

type Phase = 'idle' | 'charging' | 'burst' | 'reveal' | 'done';

export default function ChestOpenModal({ open, onClose, kind }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [taps, setTaps] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [revealIdx, setRevealIdx] = useState(0); // which big reveal is showing
  const [claimed, setClaimed] = useState(false);
  const { award } = useCoins();
  const { awardTrophies } = useTrophies();
  const skin = CHEST_SKIN[kind];
  const glow = skin.glow;
  const accent = skin.accent;
  const tapsNeeded = skin.taps;
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setTaps(0);
    setRewards([]);
    setRevealIdx(0);
    setClaimed(false);
  }, [open]);

  async function tapChest() {
    if (phase === 'idle') {
      setPhase('charging');
      setTaps(1);
      sfxTap();
      return;
    }
    if (phase !== 'charging') return;
    const next = taps + 1;
    sfxTap();
    if (next >= tapsNeeded + 1) {
      // last tap → burst
      setTaps(tapsNeeded + 1);
      await wait(120);
      if (!aliveRef.current) return;
      sfxClaim();
      setPhase('burst');
      const drops = rollRewards(kind);
      setRewards(drops);
      await wait(800);
      if (!aliveRef.current) return;
      setPhase('reveal');
      setRevealIdx(0);
    } else {
      setTaps(next);
    }
  }

  function advanceReveal() {
    if (phase !== 'reveal') return;
    if (revealIdx + 1 >= rewards.length) {
      setPhase('done');
    } else {
      setRevealIdx(revealIdx + 1);
    }
  }

  function claim() {
    if (claimed) return;
    sfxClaim();
    const bulk: Partial<Record<ResourceKey, number>> = {};
    for (const r of rewards) {
      if (r.apply === 'coins') award(r.amount);
      else if (r.apply === 'trophies') awardTrophies(r.amount, `Kist (${kind})`);
      else if (r.apply === 'speed') saveCity(addSpeedTokens(loadCity(), r.amount));
      else bulk[r.apply] = (bulk[r.apply] ?? 0) + r.amount;
    }
    if (Object.keys(bulk).length) addResources(bulk);
    setClaimed(true);
    window.setTimeout(onClose, 420);
  }

  // Tap progress 0..1
  const tapProgress = Math.min(taps / tapsNeeded, 1);

  // During burst, PLAY all 10 sprite frames (chest opens + lid falls off)
  const [burstFrame, setBurstFrame] = useState(0);
  useEffect(() => {
    if (phase !== 'burst') { setBurstFrame(0); return; }
    let idx = 0;
    setBurstFrame(0);
    const id = window.setInterval(() => {
      idx += 1;
      if (idx >= FRAME_COUNT) {
        setBurstFrame(FRAME_COUNT - 1);
        window.clearInterval(id);
      } else {
        setBurstFrame(idx);
      }
    }, 65);
    return () => window.clearInterval(id);
  }, [phase]);

  // Charging uses only the first half (frames 0..4) — chest opens gradually.
  // After burst the lid is gone (frame 9).
  const currentFrame =
    phase === 'burst'
      ? burstFrame
      : phase === 'reveal' || phase === 'done'
        ? FRAME_COUNT - 1
        : phase === 'charging'
          ? Math.min(4, Math.round(tapProgress * 4))
          : 0;
  const spriteScale = 4;

  // Modal body shake variants
  const bodyVariants = useMemo(() => ({
    idle:     { x: 0, y: 0 },
    charging: { x: [-1, 1, 0], y: 0, transition: { duration: 0.25 } },
    burst:    { x: [0, -14, 14, -8, 0], y: [0, -10, 4, 0], transition: { duration: 0.55, ease: 'easeOut' as const } },
    reveal:   { x: 0, y: 0 },
    done:     { x: 0, y: 0 },
  }), []);

  const bigReveal = phase === 'reveal' ? rewards[revealIdx] : null;

  return (
    <BHModal open={open} onClose={onClose} title={skin.label} accent={accent}>
      <motion.div
        animate={phase}
        variants={bodyVariants}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 360 }}
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
          {/* continuous gold particle rain (post-burst) */}
          {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
            <>
              {Array.from({ length: 10 }).map((_, i) => (
                <motion.span
                  key={`rain-${i}`}
                  initial={{ y: -40, x: (i - 5) * 26 + (Math.random() * 8 - 4), opacity: 0, rotate: 0 }}
                  animate={{ y: [-40, 220], opacity: [0, 1, 0], rotate: 360 }}
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

          {/* god-rays */}
          <AnimatePresence>
            {(phase === 'burst' || phase === 'reveal' || phase === 'done') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{ opacity: [0.95, 0.5, 0.3], scale: 2.4, rotate: 120 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `conic-gradient(from 0deg at 50% 50%,
                    ${glow}00 0deg,  ${glow}bb 10deg,  ${glow}00 22deg,
                    ${glow}00 40deg, ${glow}99 52deg,  ${glow}00 64deg,
                    ${glow}00 80deg, ${glow}bb 92deg,  ${glow}00 104deg,
                    ${glow}00 120deg,${glow}99 132deg, ${glow}00 144deg,
                    ${glow}00 160deg,${glow}bb 172deg, ${glow}00 184deg,
                    ${glow}00 200deg,${glow}99 212deg, ${glow}00 224deg,
                    ${glow}00 240deg,${glow}bb 252deg, ${glow}00 264deg,
                    ${glow}00 280deg,${glow}99 292deg, ${glow}00 304deg,
                    ${glow}00 320deg,${glow}bb 332deg, ${glow}00 344deg)`,
                  mixBlendMode: 'screen',
                  pointerEvents: 'none',
                  maskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 78%)',
                  WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 35%, transparent 78%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* pulsing radial glow that grows with tap count */}
          <motion.div
            animate={{
              scale: phase === 'burst' ? 3.4 : phase === 'charging' ? 0.7 + tapProgress * 0.8 : 0.6,
              opacity: phase === 'burst' ? 0 : phase === 'charging' ? 0.3 + tapProgress * 0.35 : 0,
            }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at center, ${glow}dd 0%, ${glow}66 30%, transparent 66%)`,
              pointerEvents: 'none',
              mixBlendMode: 'screen',
            }}
          />

          {/* floor shadow */}
          <motion.div
            animate={{
              scale: phase === 'burst' ? 1.9 : 1 + tapProgress * 0.25,
              opacity: phase === 'burst' ? 0.65 : 0.42,
            }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', bottom: 26,
              width: 180, height: 26, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
              filter: 'blur(3px)',
              pointerEvents: 'none',
            }}
          />

          {/* chest — sprite-sheet frame stepping */}
          <motion.button
            onClick={tapChest}
            disabled={phase === 'burst' || phase === 'reveal' || phase === 'done'}
            aria-label="Sla op kist"
            animate={
              phase === 'idle'
                ? { y: [0, -5, 0], scale: 1, rotate: 0 }
                : phase === 'charging'
                  ? { y: [0, -4, 0], scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }
                  : phase === 'burst'
                    ? { y: [0, -26, -10], scale: [1, 1.35, 1.2], rotate: 0 }
                    : { y: -4, scale: 1, rotate: 0 }
            }
            transition={
              phase === 'idle'
                ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                : phase === 'charging'
                  ? { duration: 0.32, ease: 'easeOut' }
                  : phase === 'burst'
                    ? { duration: 0.75, ease: 'easeOut' }
                    : { type: 'spring', stiffness: 240, damping: 22 }
            }
            whileTap={(phase === 'idle' || phase === 'charging') ? { scale: 0.94 } : undefined}
            style={{
              position: 'relative', zIndex: 3,
              background: 'transparent', border: 'none', padding: 0,
              cursor: (phase === 'idle' || phase === 'charging') ? 'pointer' : 'default',
              filter: `drop-shadow(0 10px 16px rgba(0,0,0,0.6)) drop-shadow(0 0 22px ${glow}aa)`,
            }}
          >
            <div style={{ position: 'relative' }}>
              {/* inside glow behind chest */}
              <motion.div
                animate={{
                  opacity: phase === 'idle' ? 0 : phase === 'burst' ? 1 : 0.3 + tapProgress * 0.7,
                  scale: phase === 'burst' ? 1.6 : 0.7 + tapProgress * 0.5,
                }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute',
                  left: '50%', top: '35%',
                  translate: '-50% -50%',
                  width: '80%', height: '60%',
                  background: `radial-gradient(ellipse at center, #fff6d0 0%, ${glow} 40%, ${glow}00 80%)`,
                  filter: 'blur(8px)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
              <div style={{ ...chestSpriteStyle(skin.baseRow, currentFrame, spriteScale), position: 'relative', zIndex: 2 }} />
            </div>
          </motion.button>

          {/* burst sparkles */}
          {phase === 'burst' && (
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

          {/* small tap-tap sparks per tap */}
          <AnimatePresence>
            {phase === 'charging' && taps > 0 && (
              <motion.div
                key={`spark-${taps}`}
                initial={{ opacity: 1, scale: 0.6 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  pointerEvents: 'none',
                  background: `radial-gradient(circle at center, ${glow}99 0%, transparent 55%)`,
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>

          {/* fullscreen flash on burst */}
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

        {/* ============= TAP HINT + CRACK PROGRESS ============= */}
        <div style={{ width: '100%', minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {phase === 'idle' && (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.3, repeat: Infinity }}
              style={{
                fontFamily: cinzel, fontWeight: 900, fontSize: 14,
                color: '#8a2a1a', letterSpacing: '0.2em',
                textShadow: '0 1px 0 rgba(255,240,200,.55)',
              }}
            >
              👆 TIK OM TE OPENEN
            </motion.div>
          )}
          {phase === 'charging' && (
            <>
              <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 12, color: '#8a2a1a', letterSpacing: '0.22em' }}>
                NOG {tapsNeeded - taps + 1} {tapsNeeded - taps + 1 === 1 ? 'TIK' : 'TIKS'}
              </div>
              <div style={{
                width: '100%', height: 10, borderRadius: 999,
                background: 'rgba(42,22,8,0.25)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <motion.div
                  animate={{ width: `${Math.min((taps / (tapsNeeded + 1)) * 100, 100)}%` }}
                  transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                  style={{
                    position: 'absolute', inset: '1px 0 1px 1px', borderRadius: 999,
                    background: `linear-gradient(180deg, ${glow} 0%, ${accent} 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 10px ${glow}aa`,
                  }}
                />
              </div>
            </>
          )}
          {phase === 'burst' && (
            <div style={{ fontFamily: cinzel, fontSize: 14, color: '#3a2108', letterSpacing: '0.2em', fontWeight: 900 }}>
              ⚡ SLOT BREEKT ⚡
            </div>
          )}
        </div>

        {/* ============= BIG CLASH-STYLE REWARD REVEAL ============= */}
        <AnimatePresence mode="wait">
          {bigReveal && (
            <motion.div
              key={`reveal-${revealIdx}`}
              onClick={advanceReveal}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{
                position: 'fixed', inset: 0,
                display: 'grid', placeItems: 'center',
                zIndex: 2147483647,
                cursor: 'pointer',
                background: `radial-gradient(circle at center, ${rarityColor(bigReveal.rarity)}44 0%, rgba(0,0,0,0.78) 60%)`,
                backdropFilter: 'blur(2px)',
              }}
            >
              {/* rotating conic rays behind reward */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', width: '120vw', height: '120vw', maxWidth: 800, maxHeight: 800,
                  left: '50%', top: '50%',
                  translate: '-50% -50%',
                  backgroundImage: `conic-gradient(from 0deg,
                    transparent 0deg, ${rarityColor(bigReveal.rarity)}55 12deg, transparent 24deg,
                    transparent 60deg, ${rarityColor(bigReveal.rarity)}55 72deg, transparent 84deg,
                    transparent 120deg, ${rarityColor(bigReveal.rarity)}55 132deg, transparent 144deg,
                    transparent 180deg, ${rarityColor(bigReveal.rarity)}55 192deg, transparent 204deg,
                    transparent 240deg, ${rarityColor(bigReveal.rarity)}55 252deg, transparent 264deg,
                    transparent 300deg, ${rarityColor(bigReveal.rarity)}55 312deg, transparent 324deg)`,
                  maskImage: 'radial-gradient(circle at center, black 10%, transparent 75%)',
                  WebkitMaskImage: 'radial-gradient(circle at center, black 10%, transparent 75%)',
                  pointerEvents: 'none',
                  mixBlendMode: 'screen',
                  opacity: 0.7,
                }}
              />

              {/* reward content */}
              <motion.div
                initial={{ y: 40 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                style={{
                  textAlign: 'center',
                  padding: 20,
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  style={{
                    fontFamily: cinzel, fontWeight: 900, fontSize: 'clamp(14px, 4vw, 18px)',
                    letterSpacing: '0.32em',
                    color: rarityColor(bigReveal.rarity),
                    textShadow: `0 0 14px ${rarityColor(bigReveal.rarity)}, 0 2px 0 #000`,
                    marginBottom: 8,
                  }}
                >
                  ★ {bigReveal.rarity.toUpperCase()} ★
                </motion.div>
                <motion.div
                  initial={{ scale: 0.2, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 12, delay: 0.1 }}
                  style={{
                    fontSize: 'clamp(120px, 32vw, 180px)',
                    lineHeight: 1,
                    filter: `drop-shadow(0 0 40px ${rarityColor(bigReveal.rarity)}) drop-shadow(0 4px 10px rgba(0,0,0,0.6))`,
                  }}
                >
                  {bigReveal.icon}
                </motion.div>
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.25 }}
                  style={{
                    fontFamily: cinzel, fontWeight: 900, fontSize: 'clamp(36px, 9vw, 56px)',
                    color: '#fff6d0',
                    letterSpacing: '0.02em',
                    textShadow: `0 3px 0 #000, 0 0 28px ${rarityColor(bigReveal.rarity)}`,
                    marginTop: 8,
                  }}
                >
                  +{bigReveal.amount.toLocaleString('nl-NL')}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  style={{
                    fontFamily: philosopher, fontStyle: 'italic', fontSize: 'clamp(13px, 3.5vw, 16px)',
                    color: '#E8D5A3',
                    textShadow: '0 1px 2px #000',
                    marginTop: 4,
                  }}
                >
                  {bigReveal.label}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: [0, -2, 0] }}
                  transition={{ delay: 0.8, y: { duration: 1.2, repeat: Infinity } }}
                  style={{
                    marginTop: 28,
                    fontFamily: cinzel, fontWeight: 800, fontSize: 11,
                    color: '#c9ac74', letterSpacing: '0.3em',
                    textShadow: '0 1px 2px #000',
                  }}
                >
                  TIK VOOR VOLGENDE  ({revealIdx + 1} / {rewards.length})
                </motion.div>
              </motion.div>

              {/* little sparkles sprinkling around the reward */}
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.span
                  key={`rw-spark-${revealIdx}-${i}`}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.4, 1.1, 0.5],
                    y: -60 - Math.random() * 80,
                    x: (Math.random() - 0.5) * 220,
                    rotate: 360,
                  }}
                  transition={{
                    duration: 1.8 + Math.random() * 0.8,
                    delay: 0.1 + Math.random() * 0.9,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  style={{
                    position: 'absolute', left: '50%', top: '60%',
                    fontSize: 14 + Math.random() * 12,
                    color: rarityColor(bigReveal.rarity),
                    textShadow: `0 0 8px ${rarityColor(bigReveal.rarity)}`,
                    pointerEvents: 'none',
                  }}
                >
                  {['✨', '✦', '⭐'][i % 3]}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============= CLAIM ============= */}
        {phase === 'done' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {/* summary grid of everything you got */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rewards.length, 4)}, 1fr)`, gap: 6 }}>
              {rewards.map((r, i) => (
                <motion.div
                  key={r.id + i}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    padding: '6px 3px',
                    borderRadius: 8,
                    background: `${rarityColor(r.rarity)}22`,
                    boxShadow: `inset 0 0 0 1px ${rarityColor(r.rarity)}aa`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 22 }}>{r.icon}</div>
                  <div style={{ fontFamily: cinzel, fontWeight: 900, fontSize: 13, color: '#2a1608' }}>+{r.amount}</div>
                </motion.div>
              ))}
            </div>
            <motion.button
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
          </motion.div>
        )}
      </motion.div>
    </BHModal>
  );
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
