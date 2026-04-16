'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  loadCity,
  saveCity,
  spendCoins,
  addCoins,
  addSpeedTokens,
  placeBuilding,
  removeBuilding,
  startUpgrade,
  applySpeedToken,
  processBuildQueue,
  collectFarm,
  openChest,
  isChestReady,
  chestReadyAt,
  farmPendingCoins,
  totalPopulation,
  usedPopulation,
  canAffordPopulation,
  type CityState,
  type PlacedBuilding,
} from '@/lib/cityStore';
import {
  BUILDINGS,
  BUILDING_ORDER,
  buildCost,
  upgradeCost,
  buildTimeSec,
  spriteForLevel,
  farmRateFor,
  troopsFor,
  type BuildingType,
} from '@/lib/game/buildings';
import { inBuildZone } from '@/lib/game/iso';
import { playSfx, vibrate, burstAt, shakeCity } from '@/lib/juice';
import { useCitySync } from '@/lib/useCitySync';

const CityCanvas = dynamic(() => import('./CityCanvas'), { ssr: false });

type TileTarget = { gx: number; gy: number } | null;

export default function CityClient() {
  const searchParams = useSearchParams();
  const devMode = searchParams.get('dev') === '1';

  const [state, setState] = useState<CityState>(() => loadCity());
  const [loaded, setLoaded] = useState(false);
  const [tileTarget, setTileTarget] = useState<TileTarget>(null);
  const [buildingTarget, setBuildingTarget] = useState<PlacedBuilding | null>(null);
  const [placingType, setPlacingType] = useState<BuildingType | null>(null);
  const [rotated, setRotated] = useState(false);
  const [movingBuildingId, setMovingBuildingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    const initial = processBuildQueue(loadCity());
    setState(initial);
    saveCity(initial);
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (loaded) saveCity(state);
  }, [state, loaded]);

  // Server sync
  useCitySync(state, setState, loaded);

  // Periodic tick (1s) for queue countdown + farm coin badges
  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(() => {
      setState(s => processBuildQueue(s));
      forceTick(n => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [loaded]);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1800);
  }

  function handleTapTile(gx: number, gy: number) {
    if (placingType) {
      handlePlace(placingType, gx, gy);
      return;
    }
    if (!inBuildZone(gx, gy)) {
      showFlash('Buiten je bouwzone');
      return;
    }
    setBuildingTarget(null);
    setTileTarget({ gx, gy });
    setDrawerOpen(true);
    playSfx('tap');
  }

  function handleTapBuilding(b: PlacedBuilding) {
    setTileTarget(null);
    setBuildingTarget(b);
    playSfx('tap');
  }

  function handleCollectFarm(b: PlacedBuilding) {
    setState(s => {
      const r = collectFarm(s, b.id);
      if (r.gained > 0) {
        showFlash(`+${r.gained} 🪙`);
        playSfx('collect');
        vibrate(15);
        burstAt(b.gx, b.gy, 'coin');
      }
      return r.state;
    });
  }

  function handleTapChest() {
    setState(s => {
      if (!isChestReady(s)) {
        showFlash('Chest is nog niet klaar');
        return s;
      }
      const r = openChest(s);
      if (r.gained > 0) {
        showFlash(`+${r.gained} 🪙 daily chest!`);
        playSfx('chest');
        vibrate([30, 30, 60]);
        burstAt(16, 16, 'sparkle');
        burstAt(16, 16, 'coin');
        shakeCity(10);
      }
      return r.state;
    });
  }

  function handlePickFromDrawer(type: BuildingType) {
    const cost = buildCost(type);
    if (state.coins < cost) {
      showFlash('Niet genoeg coins');
      playSfx('fail');
      return;
    }
    setPlacingType(type);
    setDrawerOpen(false);
    setTileTarget(null);
  }

  function handlePlace(type: BuildingType, gx: number, gy: number) {
    if (!inBuildZone(gx, gy)) {
      showFlash('Buiten je bouwzone');
      playSfx('fail');
      return;
    }
    const baseFp = BUILDINGS[type].footprint ?? { w: 1, h: 1 };
    const newFp = rotated ? { w: baseFp.h, h: baseFp.w } : baseFp;

    // Check all footprint tiles are on land + not occupied
    for (let dy = 0; dy < newFp.h; dy++) {
      for (let dx = 0; dx < newFp.w; dx++) {
        if (!inBuildZone(gx + dx, gy + dy)) {
          showFlash('Past niet op het eiland');
          playSfx('fail');
          return;
        }
      }
    }

    const overlap = state.buildings.some(b => {
      if (b.id === movingBuildingId) return false; // skip the building being moved
      const bFp = BUILDINGS[b.type].footprint ?? { w: 1, h: 1 };
      return gx < b.gx + bFp.w && gx + newFp.w > b.gx && gy < b.gy + bFp.h && gy + newFp.h > b.gy;
    });
    if (overlap) {
      showFlash('Al bezet');
      playSfx('fail');
      return;
    }

    // Moving an existing building (free)
    if (movingBuildingId) {
      setState(s => ({
        ...s,
        buildings: s.buildings.map(b =>
          b.id === movingBuildingId ? { ...b, gx, gy } : b
        ),
      }));
      setPlacingType(null);
      setMovingBuildingId(null);
      setRotated(false);
      showFlash('Verplaatst!');
      playSfx('build');
      vibrate(15);
      return;
    }

    // New building (costs coins + population)
    const cost = buildCost(type);
    if (state.coins < cost) {
      showFlash('Niet genoeg coins');
      playSfx('fail');
      return;
    }
    if (!canAffordPopulation(state, type)) {
      showFlash('Niet genoeg inwoners — bouw meer huizen');
      playSfx('fail');
      return;
    }
    if (state.buildQueue.length >= 3) {
      showFlash('Bouwlijst vol (max 3)');
      playSfx('fail');
      return;
    }
    setState(s => placeBuilding(spendCoins(s, cost), type, gx, gy));
    setPlacingType(null);
    setRotated(false);
    showFlash(`${BUILDINGS[type].name} gebouwd!`);
    playSfx('build');
    vibrate(20);
    burstAt(gx, gy, 'smoke');
    shakeCity(6);
  }

  function handleUpgrade() {
    if (!buildingTarget) return;
    const cost = upgradeCost(buildingTarget.type, buildingTarget.level);
    if (cost === null) { showFlash('Max level'); playSfx('fail'); return; }
    if (state.coins < cost) { showFlash('Niet genoeg coins'); playSfx('fail'); return; }
    if (state.buildQueue.length >= 3) { showFlash('Bouwlijst vol (max 3)'); playSfx('fail'); return; }
    if (state.buildQueue.some(q => q.buildingId === buildingTarget.id)) {
      showFlash('Al in bouwlijst');
      playSfx('fail');
      return;
    }
    const target = buildingTarget;
    setState(s => startUpgrade(spendCoins(s, cost), target.id));
    setBuildingTarget(null);
    playSfx('build');
    vibrate(20);
    burstAt(target.gx, target.gy, 'sparkle');
  }

  function handleRemoveBuilding() {
    if (!buildingTarget) return;
    const target = buildingTarget;
    setState(s => {
      const r = removeBuilding(s, target.id);
      if (r.refund > 0) showFlash(`Verwijderd · +${r.refund} 🪙`);
      else showFlash('Verwijderd');
      return r.state;
    });
    setBuildingTarget(null);
    playSfx('fail');
    vibrate(20);
  }

  function handleMoveBuilding() {
    if (!buildingTarget) return;
    setMovingBuildingId(buildingTarget.id);
    setPlacingType(buildingTarget.type);
    setRotated(false);
    setBuildingTarget(null);
    showFlash('Sleep naar nieuwe plek');
  }

  function handleSpeedToken(queueId: string) {
    if (state.speedTokens <= 0) {
      showFlash('Geen speed tokens — voltooi een taak');
      playSfx('fail');
      return;
    }
    setState(s => applySpeedToken(s, queueId));
    showFlash('-5 min ⚡');
    playSfx('claim');
    vibrate(15);
  }

  function handleDevCoins() {
    setState(s => addSpeedTokens(addCoins(s, 1000), 3));
    showFlash('+1000 🪙 / +3 ⚡ (dev)');
  }

  return (
    <div ref={hostRef} className="min-h-dvh bg-gradient-to-b from-[#3b2410] via-[#2a180a] to-[#0d0a06] relative overflow-hidden select-none">
      {loaded && (
        <CityCanvas
          state={state}
          mode="interactive"
          placingType={placingType}
          rotated={rotated}
          movingBuildingId={movingBuildingId}
          onTapTile={handleTapTile}
          onTapBuilding={handleTapBuilding}
          onTapChest={handleTapChest}
          onCollectFarm={handleCollectFarm}
          onReady={() => setCanvasReady(true)}
        />
      )}

      {!canvasReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0a06] gap-3 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-[#fdd069]/30 border-t-[#fdd069] animate-spin" />
          <p className="font-display text-[#fdd069] text-sm tracking-widest uppercase">Stad laden\u2026</p>
        </div>
      )}

      {/* Top bar: coins + tokens + back */}
      <div className="fixed top-0 left-0 right-0 z-20 pt-3 px-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <div className="bg-[#0d0a06]/85 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-[#fdd069]/40 shadow-md">
            <span className="text-base">🪙</span>
            <span className="font-display text-[#fdd069] text-base tabular-nums">{state.coins}</span>
          </div>
          <div className="bg-[#0d0a06]/85 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-[#9bdbff]/40 shadow-md">
            <span className="text-base">⚡</span>
            <span className="font-display text-[#9bdbff] text-base tabular-nums">{state.speedTokens}</span>
          </div>
          <div className="bg-[#0d0a06]/85 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-[#88dd88]/40 shadow-md">
            <span className="text-base">👤</span>
            <span className="font-display text-[#88dd88] text-base tabular-nums">{usedPopulation(state)}/{totalPopulation(state)}</span>
          </div>
        </div>
        <Link
          href="/"
          className="pointer-events-auto w-10 h-10 rounded-full bg-[#0d0a06]/85 backdrop-blur flex items-center justify-center text-[#fdd069] border border-[#fdd069]/40 hover:bg-[#1a0f05] active:scale-95 shadow-md"
          aria-label="Terug naar home"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* Build queue bar */}
      <BuildQueueBar state={state} onSpeedTap={handleSpeedToken} />

      {/* Daily chest readiness label */}
      <ChestStatus state={state} />

      {/* Bottom build button */}
      {!placingType && (
        <div className="fixed bottom-5 left-0 right-0 z-20 flex items-center justify-center pointer-events-none">
          <button
            onClick={() => { setDrawerOpen(true); playSfx('tap'); }}
            className="pointer-events-auto bg-gradient-to-b from-[#fdd069] to-[#c08828] text-[#1a0f05] font-display text-lg px-7 py-3 rounded-2xl shadow-[0_6px_0_#1a0f05,0_10px_30px_rgba(0,0,0,0.6)] border-2 border-[#1a0f05] active:translate-y-[2px] active:shadow-[0_4px_0_#1a0f05] transition-transform"
          >
            🏗 BOUWEN
          </button>
        </div>
      )}

      {/* Placement controls */}
      {placingType && (
        <div className="fixed bottom-5 left-0 right-0 z-20 flex flex-col items-center pointer-events-none gap-2">
          <div className="bg-[#0d0a06]/85 backdrop-blur rounded-2xl px-4 py-2 text-[#fdd069] font-display text-sm border border-[#fdd069]/40 pointer-events-auto">
            {movingBuildingId ? 'Tap om te verplaatsen' : `Tap om ${BUILDINGS[placingType].name.toLowerCase()} te plaatsen`}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {/* Rotate button — only show for buildings > 1×1 */}
            {(() => {
              const fp = BUILDINGS[placingType].footprint ?? { w: 1, h: 1 };
              return fp.w !== fp.h ? (
                <button
                  onClick={() => setRotated(r => !r)}
                  className="bg-[#0d0a06]/85 backdrop-blur text-[#fdd069] font-display text-sm px-4 py-2 rounded-xl shadow-md border-2 border-[#fdd069]/40 active:scale-95"
                >
                  🔄 Draai
                </button>
              ) : null;
            })()}
            <button
              onClick={() => { setPlacingType(null); setMovingBuildingId(null); setRotated(false); }}
              className="bg-[#7a2a1a] text-white font-display text-sm px-5 py-2 rounded-xl shadow-md border-2 border-[#1a0f05] active:scale-95"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Dev */}
      {devMode && (
        <button
          onClick={handleDevCoins}
          className="fixed bottom-24 right-4 z-30 bg-[#7a2a1a] text-white font-display text-xs px-3 py-2 rounded-lg shadow-md border-2 border-[#1a0f05]"
        >
          +1000 (dev)
        </button>
      )}

      {/* Flash toast */}
      {flash && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-[#0d0a06] text-[#fdd069] font-display px-4 py-2 rounded-full text-sm shadow-lg border border-[#fdd069]/40 pointer-events-none">
          {flash}
        </div>
      )}

      {/* Build drawer */}
      {drawerOpen && (
        <BuildDrawer
          state={state}
          onPick={handlePickFromDrawer}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Building info sheet */}
      {buildingTarget && (
        <BuildingInfoSheet
          building={buildingTarget}
          state={state}
          onClose={() => setBuildingTarget(null)}
          onUpgrade={handleUpgrade}
          onCollect={() => { handleCollectFarm(buildingTarget); setBuildingTarget(null); }}
          onRemove={handleRemoveBuilding}
          onMove={handleMoveBuilding}
        />
      )}
    </div>
  );
}

// ---------- Build Drawer ----------

function BuildDrawer({
  state,
  onPick,
  onClose,
}: {
  state: CityState;
  onPick: (t: BuildingType) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-[#3b2410] to-[#1a0f05] border-t-4 border-[#fdd069]/80 rounded-t-3xl p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.7)] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#fdd069]/50 rounded-full mx-auto mb-3" />
        <h3 className="font-display text-[#fdd069] text-xl text-center mb-3 tracking-wide">Bouwen</h3>
        <div className="grid grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto">
          {BUILDING_ORDER.map(type => {
            const def = BUILDINGS[type];
            const cost = buildCost(type);
            const can = state.coins >= cost;
            const slug = spriteForLevel(type, 1);
            return (
              <button
                key={type}
                disabled={!can}
                onClick={() => onPick(type)}
                className={`relative rounded-xl border-2 ${can ? 'border-[#fdd069]/60 bg-[#1a0f05] hover:bg-[#2a180a] active:scale-95' : 'border-[#fdd069]/20 bg-[#0d0a06] opacity-50 cursor-not-allowed'} p-2 flex flex-col items-center transition-all`}
              >
                <div className="w-full aspect-square flex items-center justify-center bg-[#0d0a06]/60 rounded-lg mb-1 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topdownSpriteUrl(slug)}
                    alt={def.name}
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="font-display text-[#fdd069] text-[11px] leading-tight text-center">{def.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-[#fdd069]/80 text-[10px]">{cost}🪙</span>
                  {(def.populationCost ?? 0) > 0 && (
                    <span className="font-display text-[#88dd88]/80 text-[10px]">{def.populationCost}👤</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-3 w-full text-center font-display text-[#fdd069]/70 text-xs uppercase tracking-wider">Sluiten</button>
      </div>
    </div>
  );
}

// ---------- Building Info Sheet ----------

function BuildingInfoSheet({
  building,
  state,
  onClose,
  onUpgrade,
  onCollect,
  onRemove,
  onMove,
}: {
  building: PlacedBuilding;
  state: CityState;
  onClose: () => void;
  onUpgrade: () => void;
  onCollect: () => void;
  onRemove: () => void;
  onMove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const def = BUILDINGS[building.type];
  const cost = upgradeCost(building.type, building.level);
  const maxed = cost === null;
  const can = !maxed && state.coins >= (cost ?? 0);
  const queueItem = state.buildQueue.find(q => q.buildingId === building.id);
  const isUpgrading = !!queueItem && queueItem.finishesAt > Date.now();
  const pendingCoins = building.type === 'farm' ? farmPendingCoins(state, building) : 0;
  const slug = spriteForLevel(building.type, building.level);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-[#3b2410] to-[#1a0f05] border-t-4 border-[#fdd069]/80 rounded-t-3xl p-5 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.7)] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#fdd069]/50 rounded-full mx-auto mb-3" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-16 h-16 bg-[#0d0a06]/60 rounded-xl border-2 border-[#fdd069]/40 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={topdownSpriteUrl(slug)}
              alt={def.name}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-[#fdd069] text-xl leading-tight">{def.name}</h3>
            <p className="text-[#fdd069]/70 text-xs">Level {building.level} / {def.maxLevel}</p>
            <div className="mt-1 h-1.5 bg-[#0d0a06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#fdd069] to-[#c08828]" style={{ width: `${(building.level / def.maxLevel) * 100}%` }} />
            </div>
          </div>
        </div>

        <p className="text-[#f5e9c8] text-sm mb-3">{def.description}</p>

        {building.type === 'farm' && (
          <div className="bg-[#0d0a06]/60 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
            <span className="text-[#fdd069]/80 text-xs">Productie: {farmRateFor(building.level)} 🪙/min</span>
            {pendingCoins > 0 && (
              <button onClick={onCollect} className="bg-[#fdd069] text-[#1a0f05] font-display text-xs px-3 py-1.5 rounded-lg active:scale-95 border-2 border-[#1a0f05]">
                Collect +{pendingCoins} 🪙
              </button>
            )}
          </div>
        )}

        {building.type === 'barracks' && (
          <div className="bg-[#0d0a06]/60 rounded-xl px-3 py-2 mb-3">
            <span className="text-[#fdd069]/80 text-xs">Troepen: {troopsFor(building.level)}</span>
          </div>
        )}

        {isUpgrading ? (
          <div className="w-full bg-[#0d0a06]/60 rounded-2xl px-4 py-3 text-center text-[#fdd069]/80 text-sm font-display">
            ⏳ {fmtCountdown(queueItem.finishesAt - Date.now())} resterend
          </div>
        ) : maxed ? (
          <div className="w-full bg-[#0d0a06]/60 rounded-2xl px-4 py-3 text-center text-[#fdd069]/80 text-sm font-display">
            Max level bereikt
          </div>
        ) : (
          <button
            disabled={!can}
            onClick={onUpgrade}
            className={`w-full rounded-2xl px-4 py-3 flex items-center justify-between font-display ${can ? 'bg-gradient-to-b from-[#fdd069] to-[#c08828] text-[#1a0f05] border-2 border-[#1a0f05] active:translate-y-[2px] shadow-[0_4px_0_#1a0f05]' : 'bg-[#0d0a06]/60 text-[#fdd069]/40 cursor-not-allowed border-2 border-[#fdd069]/20'}`}
          >
            <span className="text-sm">Upgrade → lvl {building.level + 1}</span>
            <span className="text-sm flex items-center gap-1">
              {cost} 🪙 · {Math.round(buildTimeSec(building.type, building.level + 1) / 60)}m
            </span>
          </button>
        )}

        {/* Move + Remove buttons */}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onClose} className="flex-1 text-center font-display text-[#fdd069]/70 text-xs uppercase tracking-wider py-2">Sluiten</button>
          <button
            onClick={onMove}
            className="text-[#9bdbff] font-display text-[10px] uppercase tracking-wider px-3 py-2 bg-[#9bdbff]/10 rounded-lg border border-[#9bdbff]/40 active:scale-95"
          >
            📦 Verplaats
          </button>
          {confirmRemove ? (
            <button
              onClick={onRemove}
              className="bg-[#7a1a1a] text-white font-display text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg border-2 border-[#1a0f05] active:scale-95"
            >
              Bevestig
            </button>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-[#ff8888]/70 font-display text-[10px] uppercase tracking-wider px-3 py-2 hover:text-[#ff8888]"
            >
              Verwijder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Build Queue Bar ----------

function BuildQueueBar({ state, onSpeedTap }: { state: CityState; onSpeedTap: (queueId: string) => void }) {
  const items = state.buildQueue;
  if (items.length === 0) return null;
  return (
    <div className="fixed top-14 left-0 right-0 z-20 px-3 flex flex-col gap-1 pointer-events-none">
      {items.map(q => {
        const remaining = q.finishesAt - Date.now();
        const total = q.finishesAt - q.startedAt;
        const pct = Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
        const def = BUILDINGS[q.type];
        return (
          <div
            key={q.id}
            className="pointer-events-auto bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069]/40 rounded-xl px-3 py-1.5 flex items-center gap-2 max-w-md mx-auto w-full"
          >
            <span className="text-base">🏗</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-display text-[#fdd069]">
                <span>{def.name} → lvl {q.toLevel}</span>
                <span className="tabular-nums">{fmtCountdown(remaining)}</span>
              </div>
              <div className="h-1.5 bg-[#1a0f05] rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-gradient-to-r from-[#fdd069] to-[#c08828]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button
              onClick={() => onSpeedTap(q.id)}
              className="text-base px-1.5 py-0.5 rounded bg-[#9bdbff]/20 border border-[#9bdbff]/60 text-[#9bdbff] active:scale-95"
              title="Speed token (-5min)"
            >
              ⚡
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Chest Status ----------

function ChestStatus({ state }: { state: CityState }) {
  const ready = isChestReady(state);
  const remaining = chestReadyAt(state) - Date.now();
  return (
    <div className="fixed top-14 right-3 z-10 pointer-events-none">
      {ready ? (
        <div className="bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069] rounded-full px-3 py-1 text-[#fdd069] font-display text-[11px] animate-pulse">
          🎁 Chest klaar!
        </div>
      ) : (
        <div className="bg-[#0d0a06]/60 backdrop-blur border border-[#fdd069]/30 rounded-full px-3 py-1 text-[#fdd069]/60 font-display text-[10px] tabular-nums">
          🎁 {fmtCountdown(remaining)}
        </div>
      )}
    </div>
  );
}

/** Map a building sprite slug to its preview image URL. */
function topdownSpriteUrl(slug: string): string {
  if (slug.startsWith('ts:')) {
    // ts:blue:castle → /assets/topdown/buildings/tinyswords/blue/castle.png
    const [, color, kind] = slug.split(':');
    return `/assets/topdown/buildings/tinyswords/${color}/${kind}.png`;
  }
  if (slug.startsWith('big_house')) return '/assets/topdown/buildings/big_houses.png';
  return `/assets/topdown/buildings/${slug}.png`;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}u ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
