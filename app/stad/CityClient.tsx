'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loadCity, saveCity, addBuilding, upgradeBuilding, spendCoins, addCoins, claimProduction, type CityState, type PlacedBuilding } from '@/lib/cityStore';
import { BUILDINGS, BUILDING_ORDER, buildCost, upgradeCost, type BuildingType } from '@/lib/game/buildings';

const CityCanvas = dynamic(() => import('./CityCanvas'), { ssr: false });

type TileTarget = { gx: number; gy: number } | null;
type BuildingTarget = PlacedBuilding | null;

export default function CityClient() {
  const searchParams = useSearchParams();
  const devMode = searchParams.get('dev') === '1';
  const [state, setState] = useState<CityState>({ coins: 0, buildings: [], lastProductionTickAt: Date.now() });
  const [loaded, setLoaded] = useState(false);
  const [tileTarget, setTileTarget] = useState<TileTarget>(null);
  const [buildingTarget, setBuildingTarget] = useState<BuildingTarget>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadCity();
    const { state: claimed, gained } = claimProduction(loaded);
    setState(claimed);
    setLoaded(true);
    if (gained > 0) showFlash(`+${gained} 🪙 productie`);
  }, []);

  // Periodic production tick while page is open
  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(() => {
      setState(s => {
        const { state: next } = claimProduction(s);
        return next;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [loaded]);

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
    <div
      className="min-h-dvh relative overflow-hidden select-none"
      style={{
        background:
          'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(255,200,100,0.22) 0%, rgba(255,160,50,0) 70%), linear-gradient(180deg, #5c1a28 0%, #3d1220 30%, #1a0510 100%)',
      }}
    >
      {loaded && <CityCanvas state={state} onTapTile={handleTapTile} onTapBuilding={handleTapBuilding} />}

      {/* Top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between pointer-events-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingLeft: 14, paddingRight: 14 }}
      >
        <div
          className="pointer-events-auto flex items-center gap-2"
          style={{
            padding: '6px 14px 6px 8px',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #5c2030 0%, #2a0a18 55%, #140208 100%)',
            border: '2px solid #f0b840',
            boxShadow:
              'inset 0 1.5px 0 rgba(255,220,140,0.5), inset 0 -1.5px 0 rgba(0,0,0,0.85), 0 2px 0 #0d0208, 0 4px 10px rgba(0,0,0,0.6)',
            color: '#fff6dc',
          }}
        >
          <span
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 28%, #5a1e2e 0%, #1a0510 80%)',
              border: '2px solid #f0b840',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,246,220,0.3)',
            }}
          >
            <svg viewBox="0 0 32 32" width="18" height="18">
              <circle cx="16" cy="16" r="11" fill="#f0b840" stroke="#0d0208" strokeWidth="2" />
              <circle cx="16" cy="16" r="7" fill="#fdd069" stroke="#0d0208" strokeWidth="1.2" />
            </svg>
          </span>
          <span className="font-display tabular-nums" style={{ fontSize: 16, color: '#fff6dc', textShadow: '0 1.5px 0 #0d0208' }}>{state.coins}</span>
        </div>
        <Link
          href="/"
          className="pointer-events-auto kenney-btn-square kenney-btn-square-brown"
          aria-label="Terug naar home"
          style={{ minWidth: 44, minHeight: 44, padding: '6px 4px' }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff6dc" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* Bottom dev bar (only with ?dev=1) */}
      {devMode && (
        <div className="fixed bottom-4 left-0 right-0 z-10 flex items-center justify-center pointer-events-none">
          <button
            onClick={handleDevCoins}
            className="kenney-btn kenney-btn-beige pointer-events-auto"
            style={{ fontSize: 14, minHeight: 48, padding: '10px 20px 14px' }}
          >
            +100 (dev)
          </button>
        </div>
      )}

      {/* Flash toast */}
      {flash && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-30 animate-fade-up pointer-events-none"
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #5c2030 0%, #1a0510 100%)',
            border: '2px solid #f0b840',
            color: '#fff6dc',
            fontSize: 13,
            textShadow: '0 1.5px 0 #0d0208',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          {flash}
        </div>
      )}

      {/* Build menu */}
      {tileTarget && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setTileTarget(null)}>
          <div
            className="kenney-panel-wood w-full max-w-sm"
            onClick={e => e.stopPropagation()}
            style={{ padding: '22px 22px 18px', color: '#fff6dc' }}
          >
            <h3 className="font-display" style={{ fontSize: 22, color: '#fff6dc', textShadow: '0 2px 0 #0d0208', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
              Wat wil je bouwen?
            </h3>
            <p style={{ color: '#fae6b6', fontSize: 11, marginBottom: 14, letterSpacing: '0.08em' }}>Tegel {tileTarget.gx},{tileTarget.gy}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BUILDING_ORDER.map(type => {
                const def = BUILDINGS[type];
                const cost = buildCost(type);
                const can = state.coins >= cost;
                return (
                  <button
                    key={type}
                    disabled={!can}
                    onClick={() => handleBuild(type)}
                    className="kenney-btn kenney-btn-beige"
                    style={{
                      minHeight: 58,
                      padding: '12px 16px 16px',
                      opacity: can ? 1 : 0.45,
                      pointerEvents: can ? 'auto' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '100%',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 14 }}>{def.name}</span>
                      <span style={{ display: 'block', fontSize: 10, opacity: 0.75, textTransform: 'none', letterSpacing: 0 }}>{def.description}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 15 }}>
                      {cost}
                      <svg viewBox="0 0 32 32" width="16" height="16">
                        <circle cx="16" cy="16" r="11" fill="#f0b840" stroke="#0d0208" strokeWidth="2" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setTileTarget(null)} className="font-display" style={{ marginTop: 14, width: '100%', textAlign: 'center', color: '#fae6b6', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Annuleren</button>
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
          <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setBuildingTarget(null)}>
            <div
              className="kenney-panel-wood w-full max-w-sm"
              onClick={e => e.stopPropagation()}
              style={{ padding: '22px 22px 18px' }}
            >
              <h3 className="font-display" style={{ fontSize: 22, color: '#fff6dc', textShadow: '0 2px 0 #0d0208', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{def.name}</h3>
              <p style={{ color: '#fdd069', fontSize: 11, marginBottom: 4, letterSpacing: '0.08em' }}>LEVEL {buildingTarget.level} / {def.maxLevel}</p>
              <p style={{ color: '#fae6b6', fontSize: 12, marginBottom: 14 }}>{def.description}</p>
              {maxed ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(13,2,8,0.6)',
                    border: '2px dashed rgba(240,184,64,0.5)',
                    textAlign: 'center',
                    color: '#fae6b6',
                    fontSize: 13,
                  }}
                >
                  Max level bereikt
                </div>
              ) : (
                <button
                  disabled={!can}
                  onClick={handleUpgrade}
                  className="kenney-btn kenney-btn-beige"
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: '12px 18px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14,
                    opacity: can ? 1 : 0.45,
                    pointerEvents: can ? 'auto' : 'none',
                  }}
                >
                  <span>Upgrade lvl {buildingTarget.level + 1}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {cost}
                    <svg viewBox="0 0 32 32" width="16" height="16">
                      <circle cx="16" cy="16" r="11" fill="#f0b840" stroke="#0d0208" strokeWidth="2" />
                    </svg>
                  </span>
                </button>
              )}
              <button onClick={() => setBuildingTarget(null)} className="font-display" style={{ marginTop: 14, width: '100%', textAlign: 'center', color: '#fae6b6', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sluiten</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
