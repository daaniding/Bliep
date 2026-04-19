'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CAMPS, DIFFICULTY_MULT, loadPveState, savePveState, cooldownRemainingMs, isOnCooldown, winChance, wallRefundFraction, type PveCamp, type Difficulty } from '@/lib/pveCamps';
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
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,0.55), rgba(0,0,0,0.85))', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.1 }}
            className="text-6xl mb-2"
          >
            {result.won ? '🎉' : '💀'}
          </motion.div>
          <motion.h3
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="font-serif text-2xl text-ink italic mb-1"
          >
            {result.won ? 'Overwinning!' : 'Verslagen'}
          </motion.h3>
          <motion.p
            initial={{ y: 4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.32 }}
            className="text-muted text-sm mb-4"
          >
            {result.camp.name}
          </motion.p>

          {/* Reward cascade */}
          <div className="bg-subtle rounded-2xl p-4 mb-5 space-y-2">
            {result.won ? (
              <>
                {typeof result.coinsDelta === 'number' && (
                  <RewardTick icon="🪙" label={`+${result.coinsDelta} coins`} color="#3a6a3a" delay={0.42} />
                )}
                {typeof result.trophiesDelta === 'number' && result.trophiesDelta > 0 && (
                  <RewardTick icon="🏆" label={`+${result.trophiesDelta} trofeeën`} color="#7a2e1a" delay={0.6} />
                )}
                {typeof result.xpGained === 'number' && (
                  <RewardTick icon="⚡" label={`+${result.xpGained} XP`} color="#2a6690" delay={0.78} />
                )}
              </>
            ) : (
              <>
                <RewardTick icon="🏆" label="−3 trofeeën" color="#7a2e1a" delay={0.42} />
                {typeof result.refund === 'number' && result.refund > 0 && (
                  <RewardTick icon="🛡" label={`+${result.refund} muur-refund`} color="#6a5828" delay={0.6} />
                )}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-faint text-xs mt-1"
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
            className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform text-sm"
          >
            Sluiten
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function RewardTick({ icon, label, color, delay }: { icon: string; label: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ x: -10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22, delay }}
      className="flex items-center justify-center gap-2"
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span className="font-bold text-lg" style={{ color }}>{label}</span>
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
    <div className="min-h-dvh bg-surface relative pb-16">
      <main className="relative z-10 pt-14 max-w-[560px] mx-auto">
        {/* Header */}
        <header className="px-5 mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-faint text-xs font-medium tracking-wider uppercase hover:text-ink transition-colors">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Terug
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#E8B84A]/15 rounded-full px-3 py-1.5">
              <span className="text-xs">🪙</span>
              <span className="text-[#8a6320] text-xs font-bold tabular-nums">{coins}</span>
            </div>
            <div className="flex items-center gap-1 bg-[#7A2E1A]/10 rounded-full px-3 py-1.5">
              <span className="text-xs">🏆</span>
              <span className="text-[#7a2e1a] text-xs font-bold tabular-nums">{trophies}</span>
            </div>
          </div>
        </header>

        <div className="px-5">
          <h1 className="font-serif text-3xl text-ink tracking-tight italic mb-1">Aanvallen</h1>
          <p className="text-muted text-sm mb-4">
            Huur huurlingen, val NPC kampen aan, win coins en trofeeën. <strong>Kazerne lvl {kazerneLvl}</strong> bepaalt je kans, <strong>muren totaal lvl {totalWallLevel}</strong> geeft {Math.round(wallRefundFraction(totalWallLevel) * 100)}% terug bij verlies.
          </p>

          {kazerneLvl === 0 && coins < 20 && (
            <div className="bg-accent/8 border border-accent/20 rounded-2xl p-4 mb-4">
              <p className="text-ink text-sm font-medium mb-1">⚔️ Eerste keer hier?</p>
              <p className="text-muted text-xs leading-relaxed">
                Verdien eerst coins door een opdracht te voltooien. Dan kun je het Bandiet kamp aanvallen voor je eerste echte loot. Bouw daarna een Kazerne in je stad om de zwaardere kampen te kunnen winnen.
              </p>
            </div>
          )}

          {/* DEV: test buttons — gated achter ?dev=1 */}
          {devMode && (
            <div className="flex gap-3 mb-4">
              <button
                className="text-[10px] text-faint underline"
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
                className="text-[10px] text-[#c75b3d] underline"
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

          <div className="space-y-3">
            {CAMPS.map(camp => {
              const cooldownLeft = cooldownRemainingMs(camp, pveState);
              const onCd = cooldownLeft > 0;
              const tooPoor = coins < camp.hireCost;
              const chance = Math.round(winChance(camp, kazerneLvl) * 100);
              return (
                <button
                  key={camp.id}
                  disabled={onCd || tooPoor}
                  onClick={() => handleAttack(camp)}
                  className={`w-full text-left card-elevated p-5 transition-all ${
                    onCd || tooPoor ? 'opacity-50' : 'active:scale-[0.98] hover:brightness-[1.02]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <SpritePreview spriteKey={camp.spriteKey} size={40} />
                      <div>
                        <p className="font-serif text-lg text-ink italic">{camp.name}</p>
                        <p className="text-faint text-[11px]">Verdediging {camp.defense}</p>
                      </div>
                    </div>
                    <div className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                      chance >= 70 ? 'bg-[#6BA368]/15 text-[#3a6a3a]' :
                      chance >= 40 ? 'bg-[#E8B84A]/15 text-[#8a6320]' :
                      'bg-[#C75B3D]/15 text-[#7a2e1a]'
                    }`}>
                      {chance}% kans
                    </div>
                  </div>
                  <p className="text-muted text-xs mb-3">{camp.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-faint">Kost</span>
                      <span className="font-bold text-ink">{camp.hireCost} 🪙</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-faint">Winst</span>
                      <span className="font-bold text-[#3a6a3a]">+{camp.rewardCoins} 🪙</span>
                      <span className="font-bold text-[#7a2e1a]">+{camp.rewardTrophies} 🏆</span>
                    </div>
                  </div>
                  {onCd && (
                    <p className="text-center text-[11px] text-faint mt-3 font-medium">
                      ⏳ Cooldown: {fmtCooldown(cooldownLeft)}
                    </p>
                  )}
                  {!onCd && tooPoor && (
                    <p className="text-center text-[11px] text-[#7a2e1a] mt-3 font-medium">
                      Niet genoeg coins
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Confirm dialog */}
      {confirmCamp && !battling && !result && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmCamp(null)}>
          <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <SpritePreview spriteKey={confirmCamp.spriteKey} size={64} />
              </div>
              <h3 className="font-serif text-xl text-ink italic mb-1">Aanval starten?</h3>
              <p className="text-muted text-sm mb-4">{confirmCamp.name}</p>
              <div className="bg-subtle rounded-2xl p-4 mb-5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Huurprijs</span>
                  <span className="font-bold text-ink">{confirmCamp.hireCost} 🪙</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Win-kans</span>
                  <span className="font-bold text-ink">{Math.round(winChance(confirmCamp, kazerneLvl) * 100)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Bij winst</span>
                  <span className="font-bold text-[#3a6a3a]">+{confirmCamp.rewardCoins} 🪙 +{confirmCamp.rewardTrophies} 🏆</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Bij verlies</span>
                  <span className="font-bold text-[#7a2e1a]">−3 🏆</span>
                </div>
              </div>
              {kazerneLvl === 0 && (
                <div className="bg-[#C75B3D]/10 border border-[#C75B3D]/20 rounded-xl p-3 mb-4 text-left">
                  <p className="text-[#7a2e1a] text-xs font-semibold mb-0.5">⚠️ Geen verdediging!</p>
                  <p className="text-[#7a2e1a]/70 text-[11px]">
                    Bouw een Kazerne of Wachttoren in je stad voor soldaten en boogschutters die terugvechten.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map(diff => {
                  const dm = DIFFICULTY_MULT[diff];
                  const cost = Math.round(confirmCamp.hireCost * dm.cost);
                  const reward = Math.round(confirmCamp.rewardCoins * dm.reward);
                  const canAfford = coins >= cost;
                  return (
                    <button
                      key={diff}
                      disabled={!canAfford}
                      onClick={() => startBattle(diff)}
                      className={`w-full py-3 rounded-2xl active:scale-[0.98] transition-transform text-sm font-semibold ${
                        canAfford ? 'text-white' : 'opacity-40 text-white'
                      }`}
                      style={{ backgroundColor: canAfford ? dm.color : '#666' }}
                    >
                      {dm.label} — {cost} 🪙 → {reward} 🪙
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setConfirmCamp(null)} className="w-full text-faint text-xs font-medium py-2">
                Annuleer
              </button>
            </div>
          </div>
        </div>
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
