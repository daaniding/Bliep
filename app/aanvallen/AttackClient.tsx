'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CAMPS, DIFFICULTY_MULT, loadPveState, savePveState, cooldownRemainingMs, isOnCooldown, winChance, wallRefundFraction, type PveCamp, type Difficulty } from '@/lib/pveCamps';
import { waveBreakdown } from '@/lib/game/battleEngine';
import { loadCity, saveCity, addCoins, spendCoins, resetCity, addXp } from '@/lib/cityStore';
import { XP_SOURCES } from '@/lib/xp';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import BattleIsland from './BattleIsland';
import LevelUpModal from '../components/modals/LevelUpModal';
import ChestOpenModal from '../components/modals/ChestOpenModal';
import { loadInventory, consumeChest, grantChest, type ChestKind, type ChestSlot as ChestSlotType } from '@/lib/chests';
import type { EnemySpriteKey } from '@/lib/pveCamps';
import type { CityState } from '@/lib/cityStore';

/** Sprite preview: shows first frame of a sprite strip via CSS crop. */
function SpritePreview({ spriteKey, size = 40 }: { spriteKey: EnemySpriteKey; size?: number }) {
  // frame dimensions per sprite type
  const info: Record<EnemySpriteKey, { src: string; fw: number; fh: number; frames: number }> = {
    'light-bandit': { src: '/assets/walkers3/light-bandit.png', fw: 48, fh: 48, frames: 8 },
    'heavy-bandit': { src: '/assets/walkers3/heavy-bandit.png', fw: 48, fh: 48, frames: 8 },
    'wolf': { src: '/assets/topdown/minifolks/wolf.png', fw: 32, fh: 32, frames: 4 },
    'bear': { src: '/assets/topdown/minifolks/bear.png', fw: 32, fh: 32, frames: 4 },
    'boar': { src: '/assets/topdown/minifolks/boar.png', fw: 32, fh: 32, frames: 4 },
  };
  const s = info[spriteKey];
  const scale = size / s.fh;
  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={s.src}
        alt=""
        style={{
          imageRendering: 'pixelated',
          width: s.fw * s.frames * scale,
          height: size,
          objectFit: 'cover',
          objectPosition: '0 0',
        }}
      />
    </div>
  );
}

// ============================================================
// Pre-battle lobby with wave breakdown
// ============================================================

interface PreBattleLobbyProps {
  camp: PveCamp;
  coins: number;
  kazerneLvl: number;
  onStart: (diff: Difficulty) => void;
  onClose: () => void;
}

const TIER_META: Record<'scout' | 'soldier' | 'elite', { icon: string; label: string; color: string }> = {
  scout:   { icon: '🏃', label: 'Verkenner', color: '#9ad4a2' },
  soldier: { icon: '⚔',  label: 'Soldaat',   color: '#fdd069' },
  elite:   { icon: '🛡', label: 'Elite',     color: '#e07260' },
};

function PreBattleLobby({ camp, coins, kazerneLvl, onStart, onClose }: PreBattleLobbyProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const waves = waveBreakdown(camp, difficulty);
  const totalEnemies = waves.reduce((s, w) => s + w.count, 0);
  const dm = DIFFICULTY_MULT[difficulty];
  const cost = Math.round(camp.hireCost * dm.cost);
  const rewardCoins = Math.round(camp.rewardCoins * dm.reward);
  const rewardTrophies = Math.round(camp.rewardTrophies * dm.reward);
  const canAfford = coins >= cost;
  const chance = Math.round(winChance(camp, kazerneLvl) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(30,10,5,0.7), rgba(0,0,0,0.92))',
        backdropFilter: 'blur(6px)',
        overflowY: 'auto',
        padding: 14,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="game-panel game-panel-corners relative"
        style={{
          width: 'min(480px, 100%)',
          margin: 'auto',
          padding: 16,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute z-10"
          style={{
            top: -14,
            right: -4,
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '2.5px solid #0d0a06',
            cursor: 'pointer',
            background: 'radial-gradient(ellipse 70% 40% at 50% 15%, rgba(255,250,210,0.85), transparent 70%), linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 3px 0 #4a2a08, 0 4px 10px rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="#2a1608" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 62,
              height: 62,
              borderRadius: 14,
              background: 'radial-gradient(circle at 30% 28%, rgba(253,208,105,0.22) 0%, rgba(26,15,5,0.9) 100%)',
              border: '2.5px solid #0d0a06',
              boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.2), 0 3px 0 #0d0a06',
            }}
          >
            <SpritePreview spriteKey={camp.spriteKey} size={48} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="game-section-label">Aanval gepland</p>
            <h3 className="game-h2 mt-0.5">{camp.name}</h3>
            <p className="game-body-italic text-[11px] mt-1">Verdediging {camp.defense} · {chance}% kans</p>
          </div>
        </div>

        {/* Wave breakdown — the star of the show */}
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(40,28,16,0.55) 0%, rgba(20,12,6,0.75) 100%)',
            border: '1.5px solid rgba(253,208,105,0.22)',
            marginBottom: 12,
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="game-section-label">Waves</p>
            <p
              className="font-display tabular-nums"
              style={{ fontSize: 12, color: '#fdd069', textShadow: '0 1px 0 #0d0a06', letterSpacing: '0.05em' }}
            >
              {totalEnemies} VIJANDEN
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {waves.map((w, idx) => {
              const meta = TIER_META[w.tier];
              return (
                <motion.div
                  key={idx}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + idx * 0.06 }}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(13,10,6,0.55)',
                    border: '1px solid rgba(253,208,105,0.15)',
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center font-display"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
                      border: '2px solid #0d0a06',
                      color: '#fdd069',
                      fontSize: 11,
                      textShadow: '0 1px 0 #0d0a06',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-display truncate"
                      style={{ fontSize: 12, color: meta.color, textShadow: '0 1px 0 #0d0a06', letterSpacing: '0.03em' }}
                    >
                      {meta.label}
                    </p>
                  </div>
                  <div
                    className="font-display tabular-nums"
                    style={{
                      fontSize: 13,
                      color: '#fff6dc',
                      textShadow: '0 1px 0 #0d0a06',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ×{w.count}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Rewards summary */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(40,70,40,0.45)',
              border: '1.5px solid rgba(120,180,120,0.35)',
            }}
          >
            <p className="game-section-label" style={{ color: '#8ab49a' }}>Winst</p>
            <p
              className="font-display mt-0.5 tabular-nums"
              style={{ fontSize: 14, color: '#a8d8b4', textShadow: '0 1px 0 #0d0a06' }}
            >
              +{rewardCoins} 🪙 +{rewardTrophies} 🏆
            </p>
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(90,30,20,0.45)',
              border: '1.5px solid rgba(180,80,60,0.35)',
            }}
          >
            <p className="game-section-label" style={{ color: '#e07260' }}>Verlies</p>
            <p
              className="font-display mt-0.5 tabular-nums"
              style={{ fontSize: 14, color: '#ffb5a0', textShadow: '0 1px 0 #0d0a06' }}
            >
              −3 🏆
            </p>
          </div>
        </div>

        {kazerneLvl === 0 && (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: 'rgba(90,30,20,0.35)',
              border: '1.5px solid rgba(180,80,60,0.4)',
              marginBottom: 12,
            }}
          >
            <p
              className="font-display"
              style={{ fontSize: 12, color: '#ffb5a0', textShadow: '0 1px 0 #0d0a06', letterSpacing: '0.04em' }}
            >
              ⚠ Geen verdediging!
            </p>
            <p className="game-body-italic text-[11px] mt-0.5" style={{ color: '#c98a80' }}>
              Bouw Kazerne + Wachttoren voor soldaten + boogschutters.
            </p>
          </div>
        )}

        {/* Difficulty tabs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => {
            const dmL = DIFFICULTY_MULT[d];
            const active = difficulty === d;
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="font-display"
                style={{
                  padding: '8px 6px',
                  borderRadius: 10,
                  border: '2.5px solid #0d0a06',
                  cursor: 'pointer',
                  background: active
                    ? `linear-gradient(180deg, ${dmL.color}ee 0%, ${dmL.color}88 100%)`
                    : 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
                  boxShadow: active
                    ? `inset 0 2px 0 rgba(255,255,255,0.35), 0 2px 0 #0d0a06, 0 0 14px ${dmL.color}77`
                    : 'inset 0 2px 0 rgba(255,230,160,0.18), 0 2px 0 #0d0a06',
                  color: active ? '#0d0a06' : '#fdd069',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textShadow: active ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 0 #0d0a06',
                }}
              >
                {dmL.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Cost row */}
        <div
          className="flex items-center justify-between mb-3 px-1"
          style={{
            fontFamily: 'var(--font-lilita), sans-serif',
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ color: '#a08560' }}>HUURKOST</span>
          <span
            style={{ color: canAfford ? '#fdd069' : '#e07260', textShadow: '0 1px 0 #0d0a06' }}
            className="tabular-nums"
          >
            {cost} 🪙
          </span>
        </div>

        {/* Start battle */}
        <motion.button
          whileTap={canAfford ? { scale: 0.97 } : undefined}
          disabled={!canAfford}
          onClick={() => onStart(difficulty)}
          className="game-btn-blood w-full"
          style={{
            padding: '14px 16px',
            fontSize: 15,
            opacity: canAfford ? 1 : 0.5,
            cursor: canAfford ? 'pointer' : 'default',
          }}
        >
          {canAfford ? '⚔ AANVAL STARTEN' : 'NIET GENOEG COINS'}
        </motion.button>
        <button
          onClick={onClose}
          className="w-full py-2 mt-1"
          style={{
            fontSize: 11,
            color: '#a08560',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-lilita), sans-serif',
          }}
        >
          ANNULEER
        </button>
      </motion.div>
    </motion.div>
  );
}

interface ResultState {
  camp: PveCamp;
  won: boolean;
  coinsDelta?: number;
  trophiesDelta?: number;
  xpGained?: number;
  refund?: number;
}

function ResultModal({ result, onClose }: { result: ResultState; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-4"
      style={{
        background: result.won
          ? 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(253,208,105,0.3), rgba(0,0,0,0.92))'
          : 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(120,30,20,0.35), rgba(0,0,0,0.92))',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="game-panel game-panel-corners text-center"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.1 }}
          style={{ fontSize: 66, lineHeight: 1, marginBottom: 6 }}
        >
          {result.won ? '🎉' : '💀'}
        </motion.div>
        <motion.h3
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="game-h1"
          style={{ fontSize: 26, color: result.won ? '#fdd069' : '#e07260' }}
        >
          {result.won ? 'OVERWINNING' : 'VERSLAGEN'}
        </motion.h3>
        <motion.p
          initial={{ y: 4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.32 }}
          className="game-body-italic mt-1 mb-4"
          style={{ fontSize: 13 }}
        >
          {result.camp.name}
        </motion.p>

        {/* Reward cascade */}
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(40,28,16,0.55) 0%, rgba(20,12,6,0.8) 100%)',
            border: '1.5px solid rgba(253,208,105,0.22)',
            marginBottom: 14,
          }}
          className="flex flex-col gap-2"
        >
          {result.won ? (
            <>
              {typeof result.coinsDelta === 'number' && (
                <RewardTick icon="🪙" label={`+${result.coinsDelta} coins`} color="#fdd069" delay={0.42} />
              )}
              {typeof result.trophiesDelta === 'number' && result.trophiesDelta > 0 && (
                <RewardTick icon="🏆" label={`+${result.trophiesDelta} trofeeën`} color="#c9a0ff" delay={0.6} />
              )}
              {typeof result.xpGained === 'number' && (
                <RewardTick icon="⚡" label={`+${result.xpGained} XP`} color="#c0e8ff" delay={0.78} />
              )}
            </>
          ) : (
            <>
              <RewardTick icon="🏆" label="−3 trofeeën" color="#e07260" delay={0.42} />
              {typeof result.refund === 'number' && result.refund > 0 && (
                <RewardTick icon="🛡" label={`+${result.refund} muur-refund`} color="#fdd069" delay={0.6} />
              )}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="game-body-italic mt-1"
                style={{ fontSize: 11 }}
              >
                Bouw sterkere muren voor meer refund volgende keer.
              </motion.p>
            </>
          )}
        </div>
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          onClick={onClose}
          className="game-btn-gold w-full"
          style={{ padding: '12px 16px', fontSize: 14 }}
        >
          SLUITEN
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function RewardTick({ icon, label, color, delay }: { icon: string; label: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ x: -10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22, delay }}
      className="flex items-center justify-center gap-2 font-display"
      style={{
        fontSize: 18,
        color,
        textShadow: '0 1px 0 #0d0a06',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </motion.div>
  );
}

function fmtCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}u ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AttackClient() {
  const { coins } = useCoins();
  const { trophies, awardTrophies } = useTrophies();
  const [pveState, setPveState] = useState<Record<string, number>>(() => loadPveState());
  const [, setNow] = useState(Date.now());
  const [confirmCamp, setConfirmCamp] = useState<PveCamp | null>(null);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setDevMode(params.get('dev') === '1');
    } catch { /* ignore */ }
  }, []);
  const [battling, setBattling] = useState<{ camp: PveCamp; cityState: CityState; difficulty: Difficulty } | null>(null);
  const [result, setResult] = useState<{
    camp: PveCamp;
    won: boolean;
    coinsDelta?: number;
    trophiesDelta?: number;
    xpGained?: number;
    refund?: number;
  } | null>(null);
  const [kazerneLvl, setKazerneLvl] = useState(0);
  const [totalWallLevel, setTotalWallLevel] = useState(0);
  const [levelUp, setLevelUp] = useState<{ level: number; chestKind: ChestKind } | null>(null);
  const [openingSlot, setOpeningSlot] = useState<ChestSlotType | null>(null);

  // Refresh kazerne and wall stats
  useEffect(() => {
    const city = loadCity();
    const kazerne = city.buildings.filter(b => b.type === 'barracks');
    const max = kazerne.reduce((m, b) => Math.max(m, b.level), 0);
    setKazerneLvl(max);
    const walls = city.buildings.filter(b => b.type === 'wall');
    const wallSum = walls.reduce((s, b) => s + b.level, 0);
    setTotalWallLevel(wallSum);
  }, []);

  // 1s tick to update cooldowns
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleAttack = useCallback((camp: PveCamp) => {
    if (coins < camp.hireCost) return;
    if (isOnCooldown(camp, pveState)) return;
    setConfirmCamp(camp);
  }, [coins, pveState]);

  const startBattle = useCallback((diff: Difficulty) => {
    if (!confirmCamp) return;

    const dm = DIFFICULTY_MULT[diff];
    const cost = Math.round(confirmCamp.hireCost * dm.cost);

    // Spend hire cost up front
    const city = loadCity();
    saveCity(spendCoins(city, cost));

    // Snapshot city state and start the real battle
    const citySnapshot = loadCity();
    setBattling({ camp: confirmCamp, cityState: citySnapshot, difficulty: diff });
    setConfirmCamp(null);
  }, [confirmCamp]);

  /** Called by BattleIsland with the REAL outcome. */
  const handleBattleComplete = useCallback((won: boolean) => {
    if (!battling) return;
    const { camp: battleCamp, difficulty } = battling;
    const dm = DIFFICULTY_MULT[difficulty];

    if (won) {
      const rewardCoins = Math.round(battleCamp.rewardCoins * dm.reward);
      const rewardTrophies = Math.round(battleCamp.rewardTrophies * dm.reward);
      const xpAmount = difficulty === 'easy' ? XP_SOURCES.battleWinEasy
        : difficulty === 'hard' ? XP_SOURCES.battleWinHard
        : XP_SOURCES.battleWinNormal;
      const after = loadCity();
      const withCoins = addCoins(after, rewardCoins);
      const xpRes = addXp(withCoins, xpAmount);
      saveCity(xpRes.state);
      if (xpRes.leveledUp) {
        const chestKind: ChestKind = xpRes.newLevel >= 10 ? 'magic'
          : xpRes.newLevel >= 5 ? 'gold'
          : xpRes.newLevel >= 2 ? 'bronze'
          : 'wood';
        window.setTimeout(() => setLevelUp({ level: xpRes.newLevel, chestKind }), 800);
      }
      const next = { ...pveState, [battleCamp.id]: Date.now() };
      savePveState(next);
      setPveState(next);
      awardTrophies(rewardTrophies, `${battleCamp.name} verslagen (${dm.label})`);
      setResult({ camp: battleCamp, won, coinsDelta: rewardCoins, trophiesDelta: rewardTrophies, xpGained: xpAmount });
    } else {
      const cost = Math.round(battleCamp.hireCost * dm.cost);
      const refunded = Math.floor(cost * wallRefundFraction(totalWallLevel));
      if (refunded > 0) {
        const after = loadCity();
        saveCity(addCoins(after, refunded));
      }
      awardTrophies(-3, `${battleCamp.name} verloren`);
      setResult({ camp: battleCamp, won, trophiesDelta: -3, refund: refunded });
    }

    setBattling(null);
  }, [battling, pveState, awardTrophies, totalWallLevel]);

  return (
    <div className="game-shell pb-24">
      <main className="relative z-10 pt-12 max-w-[520px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          className="flex items-center justify-between mb-5"
        >
          <Link
            href="/"
            className="game-pill"
            style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.15em' }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            TERUG
          </Link>
          <div className="flex items-center gap-2">
            <div className="game-pill" style={{ padding: '6px 12px' }}>
              <span style={{ fontSize: 13 }}>🪙</span>
              <span className="tabular-nums">{coins}</span>
            </div>
            <div className="game-pill" style={{ padding: '6px 12px' }}>
              <span style={{ fontSize: 13 }}>🏆</span>
              <span className="tabular-nums">{trophies}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <p className="game-section-label">Strijdveld</p>
          <h1 className="game-h1 mt-1">Aanvallen</h1>
          <p className="game-body-italic text-[13px] mt-2 leading-relaxed">
            Huur huurlingen, val kampen aan. <b style={{ color: '#fdd069', fontStyle: 'normal' }}>Kazerne lvl {kazerneLvl}</b> bepaalt je kans, <b style={{ color: '#fdd069', fontStyle: 'normal' }}>muren {totalWallLevel}</b> geven {Math.round(wallRefundFraction(totalWallLevel) * 100)}% refund bij verlies.
          </p>
        </motion.div>

        {kazerneLvl === 0 && coins < 20 && (
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="game-panel game-panel-corners mb-4"
            style={{ padding: 14 }}
          >
            <p className="font-display" style={{ fontSize: 14, color: '#fff6dc', textShadow: '0 1px 0 #0d0a06' }}>
              ⚔️ Eerste keer hier?
            </p>
            <p className="game-body-italic text-[12px] leading-relaxed mt-1">
              Verdien eerst coins met een opdracht, val dan het Bandiet kamp aan. Bouw een Kazerne voor zwaardere vijanden.
            </p>
          </motion.div>
        )}

        {/* DEV: test buttons — gated achter ?dev=1 */}
        {devMode && (
          <div className="flex gap-3 mb-4">
            <button
              className="text-[10px] underline"
              style={{ color: '#a08560', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => {
                const city = loadCity();
                const c = addCoins(city, 5000);
                c.speedTokens += 20;
                saveCity(c);
                window.location.reload();
              }}
            >
              +5000 coins (test)
            </button>
            <button
              className="text-[10px] underline"
              style={{ color: '#e07260', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => {
                resetCity();
                localStorage.removeItem('bliep:pve:v1');
                localStorage.removeItem('bliep:streak');
                window.location.reload();
              }}
            >
              Reset alles (test)
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {CAMPS.map((camp, idx) => {
            const cooldownLeft = cooldownRemainingMs(camp, pveState);
            const onCd = cooldownLeft > 0;
            const tooPoor = coins < camp.hireCost;
            const chance = Math.round(winChance(camp, kazerneLvl) * 100);
            const chanceColor = chance >= 70 ? '#5ea05c' : chance >= 40 ? '#fdd069' : '#e07260';
            const disabled = onCd || tooPoor;
            return (
              <motion.button
                key={camp.id}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.1 + idx * 0.04 }}
                whileTap={disabled ? undefined : { scale: 0.99 }}
                disabled={disabled}
                onClick={() => handleAttack(camp)}
                className="game-panel game-panel-corners relative overflow-hidden text-left"
                style={{
                  padding: 14,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 12,
                        background: 'radial-gradient(circle at 30% 28%, rgba(253,208,105,0.18) 0%, rgba(26,15,5,0.9) 100%)',
                        border: '2.5px solid #0d0a06',
                        boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.2), 0 2px 0 #0d0a06',
                      }}
                    >
                      <SpritePreview spriteKey={camp.spriteKey} size={42} />
                    </div>
                    <div className="min-w-0">
                      <p className="game-h2" style={{ fontSize: 17 }}>{camp.name}</p>
                      <p className="game-body-italic text-[11px] mt-0.5">
                        Verdediging {camp.defense}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex-shrink-0"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(13,10,6,0.7)',
                      border: `1.5px solid ${chanceColor}66`,
                      color: chanceColor,
                      fontFamily: 'var(--font-lilita), sans-serif',
                      fontSize: 11,
                      letterSpacing: '0.05em',
                      textShadow: '0 1px 0 #0d0a06',
                    }}
                  >
                    {chance}%
                  </div>
                </div>
                <p className="game-body-italic text-[12px] leading-snug mb-3">
                  {camp.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 12, fontFamily: 'var(--font-lilita), sans-serif', color: '#a08560', letterSpacing: '0.04em' }}
                  >
                    <span>KOST</span>
                    <span style={{ color: '#fdd069', textShadow: '0 1px 0 #0d0a06' }}>{camp.hireCost} 🪙</span>
                  </div>
                  <div
                    className="flex items-center gap-3"
                    style={{ fontSize: 12, fontFamily: 'var(--font-lilita), sans-serif', letterSpacing: '0.04em' }}
                  >
                    <span style={{ color: '#5ea05c', textShadow: '0 1px 0 #0d0a06' }}>+{camp.rewardCoins} 🪙</span>
                    <span style={{ color: '#c9a0ff', textShadow: '0 1px 0 #0d0a06' }}>+{camp.rewardTrophies} 🏆</span>
                  </div>
                </div>
                {onCd && (
                  <p
                    className="text-center mt-3 font-display"
                    style={{ fontSize: 11, color: '#a08560', letterSpacing: '0.08em' }}
                  >
                    ⏳ COOLDOWN {fmtCooldown(cooldownLeft)}
                  </p>
                )}
                {!onCd && tooPoor && (
                  <p
                    className="text-center mt-3 font-display"
                    style={{ fontSize: 11, color: '#e07260', letterSpacing: '0.08em' }}
                  >
                    NIET GENOEG COINS
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      </main>

      {/* Pre-battle lobby */}
      {confirmCamp && !battling && !result && (
        <PreBattleLobby
          camp={confirmCamp}
          coins={coins}
          kazerneLvl={kazerneLvl}
          onStart={startBattle}
          onClose={() => setConfirmCamp(null)}
        />
      )}

      {/* Battle — fullscreen island view */}
      {battling && (
        <div className="fixed inset-0 z-30">
          <BattleIsland
            camp={battling.camp}
            cityState={battling.cityState}
            difficulty={battling.difficulty}
            onComplete={handleBattleComplete}
          />
        </div>
      )}

      {/* Result */}
      {result && <ResultModal result={result} onClose={() => setResult(null)} />}

      {/* Level-up celebration */}
      <LevelUpModal
        open={levelUp !== null}
        onClose={() => setLevelUp(null)}
        newLevel={levelUp?.level ?? 1}
        chestKind={levelUp?.chestKind ?? 'wood'}
        onClaim={() => {
          if (!levelUp) return;
          const res = grantChest(loadInventory(), levelUp.chestKind, { instant: true });
          if (res.ok) {
            const fresh = res.inv.slots[res.inv.slots.length - 1];
            setLevelUp(null);
            setOpeningSlot(fresh);
          } else {
            setLevelUp(null);
          }
        }}
      />
      <ChestOpenModal
        open={openingSlot !== null}
        kind={(openingSlot?.kind ?? 'wood') as ChestKind}
        onClose={() => {
          if (openingSlot) consumeChest(loadInventory(), openingSlot.id);
          setOpeningSlot(null);
        }}
      />
    </div>
  );
}
