import { BUILDINGS, buildTimeSec, farmRateFor, footprintOf, footprintsOverlap, type BuildingType } from './game/buildings';

const STORAGE_KEY = 'bliep:city:v2';
const LEGACY_KEY = 'bliep:city:v1';
const COINS_EVENT = 'bliep:coins-changed';
const CITY_EVENT = 'bliep:city-changed';
const MAX_OFFLINE_PRODUCTION_HOURS = 8;
const SPEED_TOKEN_SECONDS = 5 * 60; // 1 token = -5min on a build
const MAX_BUILD_QUEUE = 3;
const CHEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  gx: number;
  gy: number;
  level: number;
  /** Last time tap-collect was claimed for this building (farm only). */
  lastCollectAt?: number;
}

export interface BuildQueueItem {
  id: string;
  /** Building this build/upgrade belongs to (id matches PlacedBuilding.id). */
  buildingId: string;
  type: BuildingType;
  /** Level the building becomes once finished. */
  toLevel: number;
  startedAt: number;
  finishesAt: number;
}

export interface CityState {
  version: 2;
  coins: number;
  speedTokens: number;
  buildings: PlacedBuilding[];
  buildQueue: BuildQueueItem[];
  chest: { lastOpenAt: number };
  npcSeed: number;
  lastProductionTickAt: number;
  updatedAt: number;
}

interface LegacyV1 {
  coins?: number;
  buildings?: Array<{ id: string; type: BuildingType; gx: number; gy: number; level: number }>;
  lastProductionTickAt?: number;
}

// ---------- Persistence ----------

export function loadCity(): CityState {
  if (typeof window === 'undefined') return defaultCity();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV1(JSON.parse(legacy) as LegacyV1);
      saveCity(migrated);
      return migrated;
    }
  } catch { /* ignore */ }
  return defaultCity();
}

export function saveCity(state: CityState) {
  if (typeof window === 'undefined') return;
  const stamped = { ...state, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: stamped.coins }));
  window.dispatchEvent(new CustomEvent(CITY_EVENT, { detail: stamped }));
}

export function resetCity(): CityState {
  const d = defaultCity();
  saveCity(d);
  return d;
}

function defaultCity(): CityState {
  const center = Math.floor(32 / 2);
  return {
    version: 2,
    coins: 0,
    speedTokens: 0,
    buildings: [
      { id: 'start-house', type: 'house', gx: center, gy: center + 1, level: 1 },
    ],
    buildQueue: [],
    chest: { lastOpenAt: 0 },
    npcSeed: Math.floor(Math.random() * 100000),
    lastProductionTickAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function normalize(parsed: Partial<CityState>): CityState {
  const base = defaultCity();
  return {
    version: 2,
    coins: parsed.coins ?? base.coins,
    speedTokens: parsed.speedTokens ?? 0,
    buildings: parsed.buildings ?? base.buildings,
    buildQueue: parsed.buildQueue ?? [],
    chest: parsed.chest ?? base.chest,
    npcSeed: parsed.npcSeed ?? base.npcSeed,
    lastProductionTickAt: parsed.lastProductionTickAt ?? Date.now(),
    updatedAt: parsed.updatedAt ?? Date.now(),
  };
}

function migrateV1(v1: LegacyV1): CityState {
  const base = defaultCity();
  return {
    ...base,
    coins: v1.coins ?? 0,
    buildings: (v1.buildings ?? base.buildings).map(b => ({ ...b, level: Math.min(b.level, 10) })),
    lastProductionTickAt: v1.lastProductionTickAt ?? Date.now(),
  };
}

// ---------- Events ----------

export const COINS_CHANGED_EVENT = COINS_EVENT;
export const CITY_CHANGED_EVENT = CITY_EVENT;

// ---------- Selectors ----------

export function buildingAt(state: CityState, gx: number, gy: number): PlacedBuilding | null {
  return state.buildings.find(b => b.gx === gx && b.gy === gy) ?? null;
}

export function isBuilding(state: CityState, buildingId: string): BuildQueueItem | undefined {
  return state.buildQueue.find(q => q.buildingId === buildingId);
}

export function farmRatePerMin(state: CityState): number {
  return state.buildings
    .filter(b => b.type === 'farm')
    .reduce((sum, b) => sum + farmRateFor(b.level), 0);
}

// ---------- Actions ----------

export function spendCoins(state: CityState, amount: number): CityState {
  return { ...state, coins: state.coins - amount };
}

export function addCoins(state: CityState, amount: number): CityState {
  return { ...state, coins: state.coins + amount };
}

export function addSpeedTokens(state: CityState, amount: number): CityState {
  return { ...state, speedTokens: state.speedTokens + amount };
}

/** Demolish a building. Refunds 50% of base cost. Removes any pending build queue items. */
export function removeBuilding(state: CityState, buildingId: string): { state: CityState; refund: number } {
  const b = state.buildings.find(x => x.id === buildingId);
  if (!b) return { state, refund: 0 };
  // Refund: 50% of base cost summed across all upgrade levels achieved
  const def = BUILDINGS[b.type];
  let totalSpent = def.baseCost;
  for (let l = 1; l < b.level; l++) {
    totalSpent += Math.round(def.baseCost * Math.pow(def.costGrowth, l));
  }
  const refund = Math.floor(totalSpent * 0.5);
  return {
    state: {
      ...state,
      coins: state.coins + refund,
      buildings: state.buildings.filter(x => x.id !== buildingId),
      buildQueue: state.buildQueue.filter(q => q.buildingId !== buildingId),
    },
    refund,
  };
}

export function placeBuilding(state: CityState, type: BuildingType, gx: number, gy: number): CityState {
  // No overlapping — check the proposed footprint against every placed
  // building's own footprint rect.
  const { w, h } = footprintOf(type);
  if (
    state.buildings.some(b => {
      const bf = footprintOf(b.type);
      return footprintsOverlap(gx, gy, w, h, b.gx, b.gy, bf.w, bf.h);
    })
  ) {
    return state;
  }

  const id = `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const placed: PlacedBuilding = { id, type, gx, gy, level: 1 };
  const now = Date.now();
  const finishesAt = now + buildTimeSec(type, 1) * 1000;
  const queueItem: BuildQueueItem = {
    id: `q-${id}`,
    buildingId: id,
    type,
    toLevel: 1,
    startedAt: now,
    finishesAt,
  };
  return {
    ...state,
    buildings: [...state.buildings, placed],
    buildQueue: [...state.buildQueue, queueItem],
  };
}

export function startUpgrade(state: CityState, buildingId: string): CityState {
  const b = state.buildings.find(x => x.id === buildingId);
  if (!b) return state;
  if (b.level >= BUILDINGS[b.type].maxLevel) return state;
  if (state.buildQueue.some(q => q.buildingId === buildingId)) return state;
  if (state.buildQueue.length >= MAX_BUILD_QUEUE) return state;
  const now = Date.now();
  const finishesAt = now + buildTimeSec(b.type, b.level + 1) * 1000;
  const queueItem: BuildQueueItem = {
    id: `q-${buildingId}-${b.level + 1}`,
    buildingId,
    type: b.type,
    toLevel: b.level + 1,
    startedAt: now,
    finishesAt,
  };
  return { ...state, buildQueue: [...state.buildQueue, queueItem] };
}

export function applySpeedToken(state: CityState, queueId: string): CityState {
  if (state.speedTokens <= 0) return state;
  const q = state.buildQueue.find(x => x.id === queueId);
  if (!q) return state;
  if (q.finishesAt <= Date.now()) return state;
  return {
    ...state,
    speedTokens: state.speedTokens - 1,
    buildQueue: state.buildQueue.map(x =>
      x.id === queueId ? { ...x, finishesAt: x.finishesAt - SPEED_TOKEN_SECONDS * 1000 } : x,
    ),
  };
}

/** Process finished build-queue items: bump building levels and drop them. */
export function processBuildQueue(state: CityState): CityState {
  const now = Date.now();
  const finished = state.buildQueue.filter(q => q.finishesAt <= now);
  if (finished.length === 0) return state;
  const finishedById = new Map(finished.map(q => [q.buildingId, q]));
  return {
    ...state,
    buildings: state.buildings.map(b => {
      const f = finishedById.get(b.id);
      if (!f) return b;
      return { ...b, level: f.toLevel };
    }),
    buildQueue: state.buildQueue.filter(q => q.finishesAt > now),
  };
}

/** Pending coins for a given farm since its last collect time. */
export function farmPendingCoins(state: CityState, building: PlacedBuilding): number {
  if (building.type !== 'farm') return 0;
  const since = building.lastCollectAt ?? state.lastProductionTickAt;
  const now = Date.now();
  const elapsed = Math.min(now - since, MAX_OFFLINE_PRODUCTION_HOURS * 3600_000);
  const minutes = elapsed / 60_000;
  return Math.floor(farmRateFor(building.level) * minutes);
}

export function collectFarm(state: CityState, buildingId: string): { state: CityState; gained: number } {
  const b = state.buildings.find(x => x.id === buildingId);
  if (!b || b.type !== 'farm') return { state, gained: 0 };
  const gained = farmPendingCoins(state, b);
  if (gained <= 0) return { state, gained: 0 };
  return {
    state: {
      ...state,
      coins: state.coins + gained,
      buildings: state.buildings.map(x => (x.id === buildingId ? { ...x, lastCollectAt: Date.now() } : x)),
    },
    gained,
  };
}

export function collectAllFarms(state: CityState): { state: CityState; gained: number } {
  let total = 0;
  let next = state;
  for (const b of state.buildings) {
    if (b.type !== 'farm') continue;
    const r = collectFarm(next, b.id);
    next = r.state;
    total += r.gained;
  }
  return { state: next, gained: total };
}

// ---------- Daily chest ----------

export function chestReadyAt(state: CityState): number {
  return state.chest.lastOpenAt + CHEST_COOLDOWN_MS;
}

export function isChestReady(state: CityState): boolean {
  return Date.now() >= chestReadyAt(state);
}

export function openChest(state: CityState): { state: CityState; gained: number } {
  if (!isChestReady(state)) return { state, gained: 0 };
  const cityLevel = state.buildings.reduce((s, b) => s + b.level, 0);
  const gained = 25 + Math.floor(cityLevel * 5 + Math.random() * 50);
  return {
    state: {
      ...state,
      coins: state.coins + gained,
      chest: { lastOpenAt: Date.now() },
    },
    gained,
  };
}

// ---------- Tick (called periodically) ----------

export function tickCity(state: CityState): { state: CityState; flashes: string[] } {
  const flashes: string[] = [];
  let next = processBuildQueue(state);
  // Mark lastProductionTickAt for offline catch-up window
  next = { ...next, lastProductionTickAt: Date.now() };
  return { state: next, flashes };
}

// ---------- Server-merge helper (for Redis sync) ----------

export function mergeCity(local: CityState, remote: CityState | null): CityState {
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

export const MAX_BUILD_QUEUE_SIZE = MAX_BUILD_QUEUE;
export const SPEED_TOKEN_SECONDS_VALUE = SPEED_TOKEN_SECONDS;
