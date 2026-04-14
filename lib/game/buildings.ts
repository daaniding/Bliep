export type BuildingType = 'house' | 'farm' | 'barracks' | 'wall' | 'tower' | 'fountain';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  /** Cost of placing the building (level 1). */
  baseCost: number;
  /** Multiplier per level beyond the first. */
  costGrowth: number;
  /** Build time at level 1, in seconds. */
  baseBuildSec: number;
  /** Multiplier for build time per upgrade. */
  buildTimeGrowth: number;
  maxLevel: number;
  /** Sprite slug — picked from /public/assets/kenney/buildings/medievalStructure_XX.png */
  spritesPerLevel: string[];
  /** Coins per minute per level (only used by farms). */
  productionPerMin?: number[];
  /** Optional "troops produced" per level (used by barracks for PvP read-out). */
  troopsPerLevel?: number[];
  /** Y-offset adjustment for sprite anchor (positive = sprite sits lower). */
  spriteYOffset?: number;
  /** Sprite scale factor on canvas. */
  spriteScale?: number;
}

export const MAX_LEVEL = 10;

// Sprite slug helper. Kenney files are named medievalStructure_01.png … _23.png.
const slug = (n: number) => `medievalStructure_${n.toString().padStart(2, '0')}`;

/**
 * Each building uses a different Kenney sprite for visual variety per level
 * breakpoint. We re-use the same sprite within each band so we don't run out
 * of unique structures.
 */
function levelSprites(seed: number[]): string[] {
  const out: string[] = [];
  for (let l = 1; l <= MAX_LEVEL; l++) {
    if (l <= 3) out.push(slug(seed[0]));
    else if (l <= 6) out.push(slug(seed[1]));
    else if (l <= 9) out.push(slug(seed[2]));
    else out.push(slug(seed[3]));
  }
  return out;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  house: {
    type: 'house',
    name: 'Huis',
    description: 'Bevolking. Hoe meer huizen, hoe groter je rijk.',
    baseCost: 50,
    costGrowth: 1.6,
    baseBuildSec: 30,
    buildTimeGrowth: 1.7,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: levelSprites([1, 4, 11, 19]),
    spriteScale: 1.0,
  },
  farm: {
    type: 'farm',
    name: 'Boerderij',
    description: 'Produceert passief coins. Tap om binnen te halen.',
    baseCost: 100,
    costGrowth: 1.55,
    baseBuildSec: 45,
    buildTimeGrowth: 1.7,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: levelSprites([7, 8, 9, 10]),
    productionPerMin: [1, 2, 4, 7, 11, 16, 23, 32, 44, 60],
    spriteScale: 1.0,
  },
  barracks: {
    type: 'barracks',
    name: 'Kazerne',
    description: 'Levert troepen voor PvP. Meer level = meer leger.',
    baseCost: 200,
    costGrowth: 1.65,
    baseBuildSec: 90,
    buildTimeGrowth: 1.8,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: levelSprites([13, 14, 15, 16]),
    troopsPerLevel: [2, 4, 7, 11, 16, 22, 30, 40, 52, 70],
    spriteScale: 1.05,
  },
  wall: {
    type: 'wall',
    name: 'Muur',
    description: 'Houdt vijanden tegen. Onderdeel van je defense rating.',
    baseCost: 30,
    costGrowth: 1.45,
    baseBuildSec: 20,
    buildTimeGrowth: 1.6,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: levelSprites([20, 20, 21, 21]),
    spriteScale: 0.9,
  },
  tower: {
    type: 'tower',
    name: 'Wachttoren',
    description: 'Boogschutters. Schaalt verdediging.',
    baseCost: 250,
    costGrowth: 1.6,
    baseBuildSec: 80,
    buildTimeGrowth: 1.8,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: levelSprites([22, 22, 23, 23]),
    spriteScale: 1.1,
  },
  fountain: {
    type: 'fountain',
    name: 'Fontein',
    description: 'Decoratie. Geeft je stad allure.',
    baseCost: 75,
    costGrowth: 1.4,
    baseBuildSec: 25,
    buildTimeGrowth: 1.5,
    maxLevel: 5,
    spritesPerLevel: levelSprites([2, 3, 5, 6]),
    spriteScale: 0.95,
  },
};

export const BUILDING_ORDER: BuildingType[] = ['house', 'farm', 'barracks', 'tower', 'wall', 'fountain'];

export function buildCost(type: BuildingType): number {
  return BUILDINGS[type].baseCost;
}

export function upgradeCost(type: BuildingType, currentLevel: number): number | null {
  const def = BUILDINGS[type];
  if (currentLevel >= def.maxLevel) return null;
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export function buildTimeSec(type: BuildingType, currentLevel: number): number {
  // currentLevel = level the building will become after this build/upgrade
  // For initial placement, currentLevel = 1.
  const def = BUILDINGS[type];
  return Math.round(def.baseBuildSec * Math.pow(def.buildTimeGrowth, currentLevel - 1));
}

export function spriteForLevel(type: BuildingType, level: number): string {
  const def = BUILDINGS[type];
  const idx = Math.min(level, def.spritesPerLevel.length) - 1;
  return def.spritesPerLevel[idx];
}

export function farmRateFor(level: number): number {
  return BUILDINGS.farm.productionPerMin?.[level - 1] ?? 0;
}

export function troopsFor(level: number): number {
  return BUILDINGS.barracks.troopsPerLevel?.[level - 1] ?? 0;
}
