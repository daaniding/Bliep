'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CAMPS, loadPveState, savePveState, cooldownRemainingMs, isOnCooldown, winChance, wallRefundFraction, type PveCamp } from '@/lib/pveCamps';
import { loadCity, saveCity, addCoins, spendCoins, resetCity } from '@/lib/cityStore';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';
import BattleIsland from './BattleIsland';
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
  const [battling, setBattling] = useState<{ camp: PveCamp; cityState: CityState } | null>(null);
  const [result, setResult] = useState<{ camp: PveCamp; won: boolean } | null>(null);
  const [kazerneLvl, setKazerneLvl] = useState(0);
  const [totalWallLevel, setTotalWallLevel] = useState(0);

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

  const startBattle = useCallback(() => {
    if (!confirmCamp) return;

    // Spend hire cost up front
    const city = loadCity();
    saveCity(spendCoins(city, confirmCamp.hireCost));

    // Snapshot city state and start the real battle
    const citySnapshot = loadCity();
    setBattling({ camp: confirmCamp, cityState: citySnapshot });
    setConfirmCamp(null);
  }, [confirmCamp]);

  /** Called by BattleIsland with the REAL outcome. */
  const handleBattleComplete = useCallback((won: boolean) => {
    if (!battling) return;
    const { camp: battleCamp } = battling;

    if (won) {
      const after = loadCity();
      saveCity(addCoins(after, battleCamp.rewardCoins));
      const next = { ...pveState, [battleCamp.id]: Date.now() };
      savePveState(next);
      setPveState(next);
      awardTrophies(battleCamp.rewardTrophies, `${battleCamp.name} verslagen`);
    } else {
      // Refund based on walls
      const refunded = Math.floor(battleCamp.hireCost * wallRefundFraction(totalWallLevel));
      if (refunded > 0) {
        const after = loadCity();
        saveCity(addCoins(after, refunded));
      }
      awardTrophies(-3, `${battleCamp.name} verloren`);
    }

    setResult({ camp: battleCamp, won });
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

          {/* DEV: test buttons */}
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
              <button onClick={startBattle} className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl glow-accent active:scale-[0.98] transition-transform text-sm mb-2">
                {kazerneLvl === 0 ? 'Toch aanvallen' : 'Aanvallen'}
              </button>
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
            onComplete={handleBattleComplete}
          />
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setResult(null)}>
          <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-6xl mb-2">{result.won ? '🎉' : '💀'}</div>
              <h3 className="font-serif text-2xl text-ink italic mb-1">
                {result.won ? 'Overwinning!' : 'Verslagen'}
              </h3>
              <p className="text-muted text-sm mb-4">{result.camp.name}</p>
              <div className="bg-subtle rounded-2xl p-4 mb-5">
                {result.won ? (
                  <>
                    <p className="text-[#3a6a3a] font-bold text-lg">+{result.camp.rewardCoins} 🪙</p>
                    <p className="text-[#7a2e1a] font-bold text-lg">+{result.camp.rewardTrophies} 🏆</p>
                  </>
                ) : (
                  <>
                    <p className="text-[#7a2e1a] font-bold text-lg">−3 🏆</p>
                    <p className="text-faint text-xs mt-1">Je verdediging was niet sterk genoeg</p>
                  </>
                )}
              </div>
              <button onClick={() => setResult(null)} className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform text-sm">
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
