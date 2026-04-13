import type { BuildingType } from './game/buildings';

const STORAGE_KEY = 'bliep:city:v1';

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
}

export function loadCity(): CityState {
  if (typeof window === 'undefined') return defaultCity();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CityState;
  } catch { /* ignore */ }
  return defaultCity();
}

export function saveCity(state: CityState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  };
}

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
