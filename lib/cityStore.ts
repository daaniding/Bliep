import { BUILDINGS, buildTimeSec, farmRateFor, footprintOf, footprintsOverlap, populationFor, populationCostOf, type BuildingType } from './game/buildings';
import { inBuildZone, CITY_CENTER } from './game/iso';
import { generateGroves } from './game/treeGroves';
import { parseElevation, processElevation, MAP_COLS, MAP_ROWS } from './game/staticMap';

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

export interface ChopJob {
  id: string;
  gx: number;
  gy: number;
  startedAt: number;
  finishesAt: number;
}

export interface CityState {
  version: 2;
  coins: number;
  wood: number;
  speedTokens: number;
  buildings: PlacedBuilding[];
  buildQueue: BuildQueueItem[];
  /** Active tree-chop jobs with timers. */
  chopJobs: ChopJob[];
  /** "gx,gy" strings of trees already chopped (persisted so they don't respawn). */
  choppedTrees: string[];
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
  return {
    version: 2,
    coins: 0,
    wood: 0,
    speedTokens: 0,
    buildings: [],
    buildQueue: [],
    chopJobs: [],
    choppedTrees: [],
    chest: { lastOpenAt: 0 },
    npcSeed: Math.floor(Math.random() * 100000),
    lastProductionTickAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function normalize(parsed: Partial<CityState>): CityState {
  const base = defaultCity();
  // Strip legacy start-house if present in saved state
  const buildings = (parsed.buildings ?? base.buildings).filter(b => b.id !== 'start-house');

  return {
    version: 2,
    coins: parsed.coins ?? base.coins,
    wood: parsed.wood ?? 0,
    speedTokens: parsed.speedTokens ?? 0,
    buildings,
    buildQueue: parsed.buildQueue ?? [],
    chopJobs: parsed.chopJobs ?? [],
    choppedTrees: parsed.choppedTrees ?? [],
    chest: parsed.chest ?? base.chest,
    npcSeed: parsed.npcSeed ?? base.npcSeed,
    lastProductionTickAt: parsed.lastProductionTickAt ?? Date.now(),
    updatedAt: parsed.updatedAt ?? Date.now(),
  };
}

// ---- Population ----

/** Total population provided by all houses. */
export function totalPopulation(state: CityState): number {
  return state.buildings
    .filter(b => b.type === 'house')
    .reduce((sum, b) => sum + populationFor(b.level), 0);
}

/** Population used by all non-house buildings. */
export function usedPopulation(state: CityState): number {
  return state.buildings
    .filter(b => b.type !== 'house' && b.type !== 'tree' && b.type !== 'path')
    .reduce((sum, b) => sum + populationCostOf(b.type), 0);
}

/** Available population (total - used). */
export function availablePopulation(state: CityState): number {
  return totalPopulation(state) - usedPopulation(state);
}

/** Check if there's enough population to build a new building of this type. */
export function canAffordPopulation(state: CityState, type: BuildingType): boolean {
  const cost = populationCostOf(type);
  if (cost === 0) return true;
  return availablePopulation(state) >= cost;
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

export function addWood(state: CityState, amount: number): CityState {
  return { ...state, wood: state.wood + amount };
}

export function spendWood(state: CityState, amount: number): CityState {
  return { ...state, wood: state.wood - amount };
}

/** True if player has at least one lumber hut built. */
export function hasLumberHut(state: CityState): boolean {
  return state.buildings.some(b => b.type === 'lumber_hut');
}

// ---- Tree cells (deterministic from seed) ----

let _cachedTreeSet: { seed: number; set: Set<string> } | null = null;

/** All world cells occupied by a still-standing random tree (minus chopped). */
export function getTreeCellSet(state: CityState): Set<string> {
  // Seed must match CityCanvas' fallback: `state.npcSeed || 1`
  const seed = state.npcSeed || 1;
  if (!_cachedTreeSet || _cachedTreeSet.seed !== seed) {
    const elev = processElevation(parseElevation());
    const offsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
    const offsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);
    const placements = generateGroves(elev, MAP_COLS, MAP_ROWS, CITY_CENTER.gx, CITY_CENTER.gy, offsetGx, offsetGy, seed);
    const set = new Set<string>();
    for (const p of placements) {
      if (p.type === 'bush') continue; // bushes are walkable/buildable
      set.add(`${p.gx},${p.gy}`);
    }
    _cachedTreeSet = { seed, set };
  }
  // Subtract chopped
  if (state.choppedTrees.length === 0) return _cachedTreeSet.set;
  const live = new Set(_cachedTreeSet.set);
  for (const k of state.choppedTrees) live.delete(k);
  return live;
}

/** Max concurrent chop jobs = number of lumber huts. */
export function maxChoppers(state: CityState): number {
  return state.buildings.filter(b => b.type === 'lumber_hut').length;
}

/** Chop-job duration in ms. */
export const CHOP_DURATION_MS = 2 * 60 * 1000;
export const CHOP_COIN_COST = 5;
export const CHOP_WOOD_REWARD = 5;

/** Start a chop job on a tree cell. Deducts coin cost; refuses if slots full. */
export function startChop(state: CityState, gx: number, gy: number): CityState | null {
  if (state.chopJobs.length >= maxChoppers(state)) return null;
  if (state.coins < CHOP_COIN_COST) return null;
  if (state.chopJobs.some(j => j.gx === gx && j.gy === gy)) return null;
  if (state.choppedTrees.includes(`${gx},${gy}`)) return null;
  const now = Date.now();
  const job: ChopJob = {
    id: Math.random().toString(36).slice(2, 10),
    gx, gy,
    startedAt: now,
    finishesAt: now + CHOP_DURATION_MS,
  };
  return {
    ...state,
    coins: state.coins - CHOP_COIN_COST,
    chopJobs: [...state.chopJobs, job],
  };
}

/** Finish any completed chop jobs: remove, reward, mark tree chopped. */
export function settleChops(state: CityState, now = Date.now()): CityState {
  const ripe = state.chopJobs.filter(j => j.finishesAt <= now);
  if (ripe.length === 0) return state;
  const remaining = state.chopJobs.filter(j => j.finishesAt > now);
  const newChopped = [...state.choppedTrees];
  for (const j of ripe) {
    const k = `${j.gx},${j.gy}`;
    if (!newChopped.includes(k)) newChopped.push(k);
  }
  return {
    ...state,
    wood: state.wood + ripe.length * CHOP_WOOD_REWARD,
    chopJobs: remaining,
    choppedTrees: newChopped,
  };
}

/** Demolish a building. Refunds 50% of base cost. Removes any pending build queue items. */
export function removeBuilding(state: CityState, buildingId: string): { state: CityState; refund: number } {
  if (buildingId === 'start-house') return { state, refund: 0 }; // castle can't be demolished
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
  // Must be in build zone (on the island)
  if (!inBuildZone(gx, gy)) return state;

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

  // No building on still-standing trees
  const trees = getTreeCellSet(state);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (trees.has(`${gx + dx},${gy + dy}`)) return state;
    }
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
