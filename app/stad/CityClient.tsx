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
  hasLumberHut,
  maxChoppers,
  startChop,
  settleChops,
  CHOP_COIN_COST,
  CHOP_WOOD_REWARD,
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
import StoneArchNav from '../components/StoneArchNav';

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
  const [chopMode, setChopMode] = useState(false);
  const chopModeRef = useRef(false);
  useEffect(() => { chopModeRef.current = chopMode; }, [chopMode]);
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

  // Periodic tick (1s) for queue countdown + farm coin badges + chop settle
  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(() => {
      setState(s => settleChops(processBuildQueue(s)));
      forceTick(n => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [loaded]);

  // Tap-tree event → only act when chop-mode is on
  useEffect(() => {
    const onTapTree = (e: Event) => {
      const detail = (e as CustomEvent).detail as { gx: number; gy: number } | undefined;
      if (!detail) return;
      if (!chopModeRef.current) return;
      setState(s => {
        if (!hasLumberHut(s)) { showFlash('Bouw eerst een Houthakkershut (50 🪙)'); return s; }
        if (s.chopJobs.length >= maxChoppers(s)) { showFlash('Alle houthakkers zijn bezig'); return s; }
        if (s.coins < CHOP_COIN_COST) { showFlash(`Je hebt ${CHOP_COIN_COST} 🪙 nodig`); return s; }
        const next = startChop(s, detail.gx, detail.gy);
        if (!next) return s;
        vibrate(20);
        playSfx('tap');
        showFlash('🪓 Houthakker onderweg');
        return next;
      });
    };
    window.addEventListener('bliep:tap-tree', onTapTree);
    return () => window.removeEventListener('bliep:tap-tree', onTapTree);
  }, []);

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

      {/* Top bar: premium resource pills + back */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)', paddingLeft: 10, paddingRight: 10 }}>
        <div className="flex items-center justify-between">
          <div className="pointer-events-auto flex gap-1.5">
            {/* Coins pill */}
            <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-2 border-[#5a3a10] shadow-[inset_0_2px_0_rgba(255,230,160,0.35),0_3px_0_#0d0a06,0_5px_10px_rgba(0,0,0,0.45)]" style={{ background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#0d0a06] text-sm" style={{ background: 'radial-gradient(circle at 35% 30%, #fff3c6 0%, #fdd069 30%, #b8791f 80%)' }}>🪙</div>
              <span className="font-display text-[#fdd069] text-sm tabular-nums" style={{ textShadow: '0 1px 0 #0d0a06' }}>{state.coins}</span>
            </div>
            {/* Speed tokens pill */}
            <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-2 border-[#1e5a7a] shadow-[inset_0_2px_0_rgba(155,219,255,0.2),0_3px_0_#0d0a06,0_5px_10px_rgba(0,0,0,0.45)]" style={{ background: 'linear-gradient(180deg, #1a2a3a 0%, #0d1520 100%)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#0d0a06] text-sm" style={{ background: 'radial-gradient(circle at 35% 30%, #c0e8ff 0%, #4fa3d9 40%, #1e6fa8 100%)' }}>⚡</div>
              <span className="font-display text-[#9bdbff] text-sm tabular-nums" style={{ textShadow: '0 1px 0 #0d0a06' }}>{state.speedTokens}</span>
            </div>
            {/* Wood pill */}
            <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-2 border-[#5a3a10] shadow-[inset_0_2px_0_rgba(210,160,110,0.25),0_3px_0_#0d0a06,0_5px_10px_rgba(0,0,0,0.45)]" style={{ background: 'linear-gradient(180deg, #3a2412 0%, #1c100a 100%)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#0d0a06] text-sm" style={{ background: 'radial-gradient(circle at 35% 30%, #e5b07a 0%, #9c6838 40%, #5a3a18 100%)' }}>🪵</div>
              <span className="font-display text-[#e0b080] text-sm tabular-nums" style={{ textShadow: '0 1px 0 #0d0a06' }}>{state.wood}</span>
            </div>
            {/* Population pill */}
            <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-2 border-[#1e4a26] shadow-[inset_0_2px_0_rgba(94,160,92,0.2),0_3px_0_#0d0a06,0_5px_10px_rgba(0,0,0,0.45)]" style={{ background: 'linear-gradient(180deg, #1a2a18 0%, #0d150a 100%)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#0d0a06] text-sm" style={{ background: 'radial-gradient(circle at 35% 30%, #c0ffc0 0%, #5ea05c 40%, #2a6a2a 100%)' }}>👤</div>
              <span className="font-display text-[#88dd88] text-sm tabular-nums" style={{ textShadow: '0 1px 0 #0d0a06' }}>{usedPopulation(state)}/{totalPopulation(state)}</span>
            </div>
          </div>
          <Link
            href="/"
            className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center text-[#fdd069] border-2 border-[#5a3a10] active:translate-y-[1px] active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)', boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.35), 0 3px 0 #0d0a06, 0 5px 10px rgba(0,0,0,0.45)' }}
            aria-label="Terug naar home"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Build queue bar */}
      <BuildQueueBar state={state} onSpeedTap={handleSpeedToken} />

      {/* Daily chest readiness label */}

      {/* Bottom buttons — BOUWEN + HAKKEN */}
      {!placingType && (
        <div className="fixed left-0 right-0 z-20 flex items-center justify-center gap-3 pointer-events-none" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => { setDrawerOpen(true); playSfx('tap'); setChopMode(false); }}
            className="pointer-events-auto font-display text-xl px-7 py-3.5 rounded-2xl border-4 border-[#0d0a06] active:translate-y-[3px] transition-transform"
            style={{
              background: 'linear-gradient(180deg, #ffec8c 0%, #fdd069 25%, #d19225 65%, #6e4c10 100%)',
              color: '#2a1508',
              textShadow: '0 1px 0 rgba(255,240,190,0.6)',
              boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.65), inset 0 -5px 0 rgba(90,50,8,0.7), 0 6px 0 #0d0a06, 0 10px 24px rgba(255,190,80,0.35), 0 10px 22px rgba(0,0,0,0.55)',
              letterSpacing: '0.04em',
            }}
          >
            🏗 BOUWEN
          </button>
          <button
            onClick={() => { setChopMode(m => !m); playSfx('tap'); }}
            className="pointer-events-auto font-display text-xl px-6 py-3.5 rounded-2xl border-4 border-[#0d0a06] active:translate-y-[3px] transition-transform"
            style={{
              background: chopMode
                ? 'linear-gradient(180deg, #ff9a6c 0%, #e05c2a 50%, #8a2a10 100%)'
                : 'linear-gradient(180deg, #c4d89a 0%, #7ea05a 30%, #3e5c2a 70%, #1e3010 100%)',
              color: chopMode ? '#fff3d0' : '#f4ffe0',
              textShadow: '0 1px 0 rgba(0,0,0,0.4)',
              boxShadow: chopMode
                ? 'inset 0 3px 0 rgba(255,230,190,0.5), inset 0 -5px 0 rgba(80,20,5,0.7), 0 6px 0 #0d0a06, 0 10px 24px rgba(255,120,60,0.4), 0 10px 22px rgba(0,0,0,0.55)'
                : 'inset 0 3px 0 rgba(220,255,180,0.5), inset 0 -5px 0 rgba(30,50,15,0.7), 0 6px 0 #0d0a06, 0 10px 24px rgba(140,200,90,0.3), 0 10px 22px rgba(0,0,0,0.55)',
            }}
          >
            🪓 {chopMode ? 'STOP' : 'HAKKEN'}
          </button>
        </div>
      )}

      {/* Placement controls */}
      {placingType && (
        <div className="fixed left-0 right-0 z-20 flex flex-col items-center pointer-events-none gap-2" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
          <div
            className="font-display text-sm px-5 py-2.5 rounded-2xl border-2 border-[#3a2718] pointer-events-auto"
            style={{ background: 'linear-gradient(180deg, #2a1a0a 0%, #0d0a06 100%)', color: '#fdd069', textShadow: '0 1px 0 #0d0a06', boxShadow: 'inset 0 1px 0 rgba(255,230,160,0.2), 0 3px 0 #0d0a06' }}
          >
            {movingBuildingId ? 'Tap om te verplaatsen' : `Tap om ${BUILDINGS[placingType].name.toLowerCase()} te plaatsen`}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {(() => {
              const fp = BUILDINGS[placingType].footprint ?? { w: 1, h: 1 };
              return fp.w !== fp.h ? (
                <button
                  onClick={() => setRotated(r => !r)}
                  className="font-display text-sm px-4 py-2 rounded-xl border-2 border-[#5a3a10] active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)', color: '#fdd069', textShadow: '0 1px 0 #0d0a06', boxShadow: 'inset 0 1px 0 rgba(255,230,160,0.25), 0 3px 0 #0d0a06' }}
                >
                  🔄 Draai
                </button>
              ) : null;
            })()}
            <button
              onClick={() => { setPlacingType(null); setMovingBuildingId(null); setRotated(false); }}
              className="font-display text-sm px-5 py-2 rounded-xl border-2 border-[#0d0a06] active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(180deg, #7a1e0a 0%, #3d0a00 100%)', color: '#fff3c6', textShadow: '0 1px 0 #0d0a06', boxShadow: 'inset 0 1px 0 rgba(255,100,70,0.3), 0 3px 0 #0d0a06' }}
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

      {/* Flash toast — premium floating pill */}
      {flash && (
        <div
          className="fixed top-18 left-1/2 -translate-x-1/2 z-40 font-display px-5 py-2.5 rounded-full text-sm pointer-events-none border-2 border-[#5a3a10]"
          style={{
            background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
            color: '#fdd069',
            textShadow: '0 1px 0 #0d0a06, 0 0 8px rgba(253,208,105,0.4)',
            boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.3), 0 4px 0 #0d0a06, 0 8px 20px rgba(0,0,0,0.6)',
            animation: 'fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          {flash}
        </div>
      )}

      {/* Active chop timers in topbar */}
      {state.chopJobs.length > 0 && (
        <div className="fixed z-20 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 62px)', right: 10 }}>
          <div className="flex flex-col gap-1 items-end">
            {state.chopJobs.map(job => {
              const remaining = Math.max(0, job.finishesAt - Date.now());
              const mins = Math.floor(remaining / 60000);
              const secs = Math.floor((remaining % 60000) / 1000);
              return (
                <div key={job.id} className="font-display text-[11px] tabular-nums px-3 py-1 rounded-full border-2 border-[#5a3a10] flex items-center gap-1.5" style={{ background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)', color: '#e0b080', textShadow: '0 1px 0 #0d0a06', boxShadow: '0 2px 0 #0d0a06' }}>
                  <span>🪓</span>
                  <span>{mins}:{String(secs).padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
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
    <div className="fixed left-0 right-0 z-20 px-2.5 flex flex-col gap-1.5 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
      {items.map(q => {
        const remaining = q.finishesAt - Date.now();
        const total = q.finishesAt - q.startedAt;
        const pct = Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
        const def = BUILDINGS[q.type];
        return (
          <div
            key={q.id}
            className="pointer-events-auto rounded-xl px-3 py-2 flex items-center gap-2 max-w-md mx-auto w-full border-2 border-[#3a2718]"
            style={{ background: 'linear-gradient(180deg, #2a1a0a 0%, #0d0a06 100%)', boxShadow: 'inset 0 1px 0 rgba(255,230,160,0.15), 0 3px 0 #0d0a06, 0 5px 10px rgba(0,0,0,0.4)' }}
          >
            <span className="text-base">🏗</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-display" style={{ color: '#fdd069', textShadow: '0 1px 0 #0d0a06' }}>
                <span>{def.name} → lvl {q.toLevel}</span>
                <span className="tabular-nums">{fmtCountdown(remaining)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mt-0.5" style={{ background: '#0d0a06', border: '1px solid #3a1e08' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(180deg, #ffec8c 0%, #fdd069 40%, #d19225 80%, #6e4c10 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }} />
              </div>
            </div>
            <button
              onClick={() => onSpeedTap(q.id)}
              className="text-sm w-8 h-8 rounded-lg flex items-center justify-center border-2 border-[#1e5a7a] active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(180deg, #1a2a3a 0%, #0d1520 100%)', boxShadow: 'inset 0 1px 0 rgba(155,219,255,0.2), 0 2px 0 #0d0a06' }}
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
    <div className="fixed z-10 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)', right: 10 }}>
      {ready ? (
        <div
          className="font-display text-[11px] px-3.5 py-1.5 rounded-full border-2 border-[#fdd069] gem-glow-gold"
          style={{ background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)', color: '#fdd069', textShadow: '0 1px 0 #0d0a06, 0 0 10px rgba(253,208,105,0.5)', boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.3), 0 3px 0 #0d0a06' }}
        >
          🎁 Chest klaar!
        </div>
      ) : (
        <div
          className="font-display text-[10px] tabular-nums px-3 py-1 rounded-full border-2 border-[#3a2718]"
          style={{ background: 'linear-gradient(180deg, #2a1a0a 0%, #0d0a06 100%)', color: '#a08060', textShadow: '0 1px 0 #0d0a06', boxShadow: '0 2px 0 #0d0a06' }}
        >
          🎁 {fmtCountdown(remaining)}
        </div>
      )}
      <StoneArchNav />
    </div>
  );
}

/** Map a building sprite slug to its preview image URL. */
function topdownSpriteUrl(slug: string): string {
  if (slug.startsWith('ts:')) {
    const [, color, kind] = slug.split(':');
    return `/assets/topdown/buildings/tinyswords/${color}/${kind}.png`;
  }
  if (slug.startsWith('big_house')) return '/assets/topdown/buildings/big_houses.png';
  if (slug === 'farm:hut' || slug.startsWith('farm:')) {
    // Farm tileset sprites don't have standalone files — use a cozy hay house as drawer thumbnail
    return '/assets/topdown/buildings/house_hay_2.png';
  }
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
