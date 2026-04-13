'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CAMPS, loadPveState, savePveState, cooldownRemainingMs, isOnCooldown, resolveBattle, winChance, type PveCamp, type BattleResult } from '@/lib/pveCamps';
import { loadCity, saveCity, addCoins, spendCoins } from '@/lib/cityStore';
import { useCoins } from '@/lib/useCoins';
import { useTrophies } from '@/lib/useTrophies';

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
  const [battling, setBattling] = useState(false);
  const [result, setResult] = useState<{ camp: PveCamp; result: BattleResult } | null>(null);
  const [kazerneLvl, setKazerneLvl] = useState(0);

  // Refresh kazerne level
  useEffect(() => {
    const city = loadCity();
    const kazerne = city.buildings.filter(b => b.type === 'barracks');
    const max = kazerne.reduce((m, b) => Math.max(m, b.level), 0);
    setKazerneLvl(max);
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

  const startBattle = useCallback(async () => {
    if (!confirmCamp) return;
    setBattling(true);

    // Spend the hire cost up front
    const city = loadCity();
    saveCity(spendCoins(city, confirmCamp.hireCost));

    // Dramatic pause
    await new Promise(res => setTimeout(res, 1400));

    const battleResult = resolveBattle(confirmCamp, kazerneLvl);

    if (battleResult.won) {
      const after = loadCity();
      saveCity(addCoins(after, battleResult.coinsGained));
      const next = { ...pveState, [confirmCamp.id]: Date.now() };
      savePveState(next);
      setPveState(next);
      awardTrophies(battleResult.trophiesDelta, `${confirmCamp.name} verslagen`);
    } else {
      awardTrophies(battleResult.trophiesDelta, `${confirmCamp.name} verloren`);
    }

    setBattling(false);
    setResult({ camp: confirmCamp, result: battleResult });
    setConfirmCamp(null);
  }, [confirmCamp, kazerneLvl, pveState, awardTrophies]);

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
          <p className="text-muted text-sm mb-6">
            Huur huurlingen, val NPC kampen aan, win coins en trofeeën. Je <strong>Kazerne lvl {kazerneLvl}</strong> bepaalt je kans.
          </p>

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
                      <span className="text-3xl">{camp.emoji}</span>
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
              <div className="text-5xl mb-2">{confirmCamp.emoji}</div>
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
              <button onClick={startBattle} className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl glow-accent active:scale-[0.98] transition-transform text-sm mb-2">
                Aanvallen
              </button>
              <button onClick={() => setConfirmCamp(null)} className="w-full text-faint text-xs font-medium py-2">
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battle in progress */}
      {battling && (
        <div className="fixed inset-0 z-30 bg-black/60 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-soft-pulse">⚔️</div>
            <p className="text-white font-serif text-xl italic">In gevecht…</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setResult(null)}>
          <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-6xl mb-2">{result.result.won ? '🎉' : '💀'}</div>
              <h3 className="font-serif text-2xl text-ink italic mb-1">
                {result.result.won ? 'Overwinning!' : 'Verslagen'}
              </h3>
              <p className="text-muted text-sm mb-4">{result.camp.name}</p>
              <div className="bg-subtle rounded-2xl p-4 mb-5">
                {result.result.won ? (
                  <>
                    <p className="text-[#3a6a3a] font-bold text-lg">+{result.result.coinsGained} 🪙</p>
                    <p className="text-[#7a2e1a] font-bold text-lg">+{result.result.trophiesDelta} 🏆</p>
                  </>
                ) : (
                  <>
                    <p className="text-[#7a2e1a] font-bold text-lg">−3 🏆</p>
                    <p className="text-faint text-xs mt-1">Je huurlingen zijn verslagen</p>
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
