import type { BuildingType } from './game/buildings';

const STORAGE_KEY = 'bliep:city:v1';
const COINS_EVENT = 'bliep:coins-changed';
const MAX_OFFLINE_PRODUCTION_HOURS = 8;

// Coins per minute per farm level
export const FARM_RATE_PER_MIN: Record<number, number> = { 1: 1, 2: 3, 3: 8 };

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  gx: number;
  gy: number;
  level: number;
}

export interface CityState {
  coins: number;
  buildings: PlacedBuilding[];
  lastProductionTickAt: number;
}

export function loadCity(): CityState {
  if (typeof window === 'undefined') return defaultCity();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CityState>;
      return {
        coins: parsed.coins ?? 0,
        buildings: parsed.buildings ?? [],
        lastProductionTickAt: parsed.lastProductionTickAt ?? Date.now(),
      };
    }
  } catch { /* ignore */ }
  return defaultCity();
}

export function saveCity(state: CityState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: state.coins }));
}

export function resetCity(): CityState {
  const d = defaultCity();
  saveCity(d);
  return d;
}

function defaultCity(): CityState {
  return {
    coins: 0,
    buildings: [
      { id: 'start-house', type: 'house', gx: 7, gy: 7, level: 1 },
    ],
    lastProductionTickAt: Date.now(),
  };
}

// --- Passive production ---

export function farmRatePerMin(state: CityState): number {
  return state.buildings
    .filter(b => b.type === 'farm')
    .reduce((sum, b) => sum + (FARM_RATE_PER_MIN[b.level] ?? 0), 0);
}

export function claimProduction(state: CityState): { state: CityState; gained: number } {
  const now = Date.now();
  const elapsedMs = now - state.lastProductionTickAt;
  if (elapsedMs <= 0) return { state, gained: 0 };
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_PRODUCTION_HOURS * 3600_000);
  const minutes = cappedMs / 60_000;
  const rate = farmRatePerMin(state);
  const gained = Math.floor(rate * minutes);
  if (gained <= 0 && rate === 0) {
    return { state: { ...state, lastProductionTickAt: now }, gained: 0 };
  }
  return {
    state: { ...state, coins: state.coins + gained, lastProductionTickAt: now },
    gained,
  };
}

// --- Coin event helpers (for cross-page sync) ---

export const COINS_CHANGED_EVENT = COINS_EVENT;

export function buildingAt(state: CityState, gx: number, gy: number): PlacedBuilding | null {
  return state.buildings.find(b => b.gx === gx && b.gy === gy) ?? null;
}

export function addBuilding(state: CityState, b: PlacedBuilding): CityState {
  return { ...state, buildings: [...state.buildings, b] };
}

export function upgradeBuilding(state: CityState, id: string): CityState {
  return {
    ...state,
    buildings: state.buildings.map(b => (b.id === id ? { ...b, level: b.level + 1 } : b)),
  };
}

export function spendCoins(state: CityState, amount: number): CityState {
  return { ...state, coins: state.coins - amount };
}

export function addCoins(state: CityState, amount: number): CityState {
  return { ...state, coins: state.coins + amount };
}
