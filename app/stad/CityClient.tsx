'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { loadCity, saveCity, addBuilding, upgradeBuilding, spendCoins, addCoins, type CityState, type PlacedBuilding } from '@/lib/cityStore';
import { BUILDINGS, BUILDING_ORDER, buildCost, upgradeCost, type BuildingType } from '@/lib/game/buildings';

const CityCanvas = dynamic(() => import('./CityCanvas'), { ssr: false });

type TileTarget = { gx: number; gy: number } | null;
type BuildingTarget = PlacedBuilding | null;

export default function CityClient() {
  const [state, setState] = useState<CityState>({ coins: 0, buildings: [] });
  const [loaded, setLoaded] = useState(false);
  const [tileTarget, setTileTarget] = useState<TileTarget>(null);
  const [buildingTarget, setBuildingTarget] = useState<BuildingTarget>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setState(loadCity());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveCity(state);
  }, [state, loaded]);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1800);
  }

  function handleTapTile(gx: number, gy: number) {
    setBuildingTarget(null);
    setTileTarget({ gx, gy });
  }

  function handleTapBuilding(b: PlacedBuilding) {
    setTileTarget(null);
    setBuildingTarget(b);
  }

  function handleBuild(type: BuildingType) {
    if (!tileTarget) return;
    const cost = buildCost(type);
    if (state.coins < cost) {
      showFlash('Niet genoeg coins');
      return;
    }
    const id = `${type}-${Date.now()}`;
    setState(s => addBuilding(spendCoins(s, cost), { id, type, gx: tileTarget.gx, gy: tileTarget.gy, level: 1 }));
    setTileTarget(null);
  }

  function handleUpgrade() {
    if (!buildingTarget) return;
    const cost = upgradeCost(buildingTarget.type, buildingTarget.level);
    if (cost === null) { showFlash('Max level'); return; }
    if (state.coins < cost) { showFlash('Niet genoeg coins'); return; }
    setState(s => upgradeBuilding(spendCoins(s, cost), buildingTarget.id));
    setBuildingTarget(b => (b ? { ...b, level: b.level + 1 } : null));
  }

  function handleDevCoins() {
    setState(s => addCoins(s, 100));
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#F4E9D1] to-[#D9C7A0] relative overflow-hidden select-none">
      {loaded && <CityCanvas state={state} onTapTile={handleTapTile} onTapBuilding={handleTapBuilding} />}

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-10 pt-4 px-4 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-white/85 backdrop-blur rounded-full px-4 py-2 flex items-center gap-2 shadow-md">
          <span className="text-lg">🪙</span>
          <span className="font-serif text-[#3a2a18] font-semibold text-lg tabular-nums">{state.coins}</span>
        </div>
        <Link
          href="/"
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-[#6B4520] hover:bg-white transition-colors active:scale-95 shadow-md"
          aria-label="Terug naar home"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* Bottom dev bar */}
      <div className="fixed bottom-4 left-0 right-0 z-10 flex items-center justify-center pointer-events-none">
        <button
          onClick={handleDevCoins}
          className="pointer-events-auto bg-[#E8B84A] text-[#3a2a18] font-bold px-5 py-2.5 rounded-full shadow-lg active:scale-95 transition-transform text-sm"
        >
          +100 🪙 (dev)
        </button>
      </div>

      {/* Flash toast */}
      {flash && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-[#3a2a18] text-white px-4 py-2 rounded-full text-sm shadow-lg animate-fade-up pointer-events-none">
          {flash}
        </div>
      )}

      {/* Build menu */}
      {tileTarget && (
        <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setTileTarget(null)}>
          <div className="bg-[#F4E9D1] rounded-3xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-[#3a2a18] italic mb-1">Wat wil je bouwen?</h3>
            <p className="text-[#6B4520] text-xs mb-4">Tegel {tileTarget.gx},{tileTarget.gy}</p>
            <div className="space-y-2">
              {BUILDING_ORDER.map(type => {
                const def = BUILDINGS[type];
                const cost = buildCost(type);
                const can = state.coins >= cost;
                return (
                  <button
                    key={type}
                    disabled={!can}
                    onClick={() => handleBuild(type)}
                    className={`w-full text-left rounded-2xl px-4 py-3 flex items-center justify-between transition-all ${can ? 'bg-white hover:bg-[#E8B84A]/20 active:scale-[0.98]' : 'bg-white/60 opacity-50 cursor-not-allowed'}`}
                  >
                    <div>
                      <p className="font-semibold text-[#3a2a18] text-sm">{def.name}</p>
                      <p className="text-[#6B4520] text-xs">{def.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#3a2a18] font-bold text-sm">
                      <span>{cost}</span>
                      <span>🪙</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setTileTarget(null)} className="mt-4 w-full text-center text-[#6B4520] text-xs font-medium">Annuleren</button>
          </div>
        </div>
      )}

      {/* Upgrade menu */}
      {buildingTarget && (() => {
        const def = BUILDINGS[buildingTarget.type];
        const cost = upgradeCost(buildingTarget.type, buildingTarget.level);
        const maxed = cost === null;
        const can = !maxed && state.coins >= (cost ?? 0);
        return (
          <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setBuildingTarget(null)}>
            <div className="bg-[#F4E9D1] rounded-3xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-serif text-xl text-[#3a2a18] italic mb-1">{def.name}</h3>
              <p className="text-[#6B4520] text-xs mb-1">Level {buildingTarget.level} / {def.maxLevel}</p>
              <p className="text-[#3a2a18] text-sm mb-4">{def.description}</p>
              {maxed ? (
                <div className="w-full bg-white/60 rounded-2xl px-4 py-3 text-center text-[#6B4520] text-sm font-medium">Max level bereikt</div>
              ) : (
                <button
                  disabled={!can}
                  onClick={handleUpgrade}
                  className={`w-full rounded-2xl px-4 py-3 flex items-center justify-between transition-all ${can ? 'bg-[#E8B84A] text-[#3a2a18] hover:brightness-110 active:scale-[0.98]' : 'bg-white/60 opacity-50 cursor-not-allowed'}`}
                >
                  <span className="font-semibold text-sm">Upgrade naar lvl {buildingTarget.level + 1}</span>
                  <span className="font-bold text-sm flex items-center gap-1">{cost}<span>🪙</span></span>
                </button>
              )}
              <button onClick={() => setBuildingTarget(null)} className="mt-4 w-full text-center text-[#6B4520] text-xs font-medium">Sluiten</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
