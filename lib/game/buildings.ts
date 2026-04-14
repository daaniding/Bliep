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

/**
 * Top-down sprite slugs. Each building has 4 visual breakpoints across its
 * 10 levels using the available Fan-tasy + Houses Pack assets.
 */
function levelSpritesT(slugs: string[]): string[] {
  const out: string[] = [];
  for (let l = 1; l <= MAX_LEVEL; l++) {
    if (l <= 3) out.push(slugs[0]);
    else if (l <= 6) out.push(slugs[1] ?? slugs[0]);
    else if (l <= 9) out.push(slugs[2] ?? slugs[1] ?? slugs[0]);
    else out.push(slugs[3] ?? slugs[2] ?? slugs[1] ?? slugs[0]);
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
    // Hay houses 1-4 → Big house variants
    spritesPerLevel: levelSpritesT(['house_hay_1', 'house_hay_2', 'house_hay_3', 'big_house_purple']),
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
    spritesPerLevel: levelSpritesT(['house_hay_2', 'house_hay_3', 'house_hay_4', 'house_hay_4']),
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
    spritesPerLevel: levelSpritesT(['wall_gate', 'wall_gate', 'big_house_grey', 'big_house_grey']),
    troopsPerLevel: [2, 4, 7, 11, 16, 22, 30, 40, 52, 70],
    spriteScale: 1.0,
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
    spritesPerLevel: levelSpritesT(['wall_gate']),
    spriteScale: 0.85,
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
    spritesPerLevel: levelSpritesT(['wall_gate', 'big_house_grey', 'big_house_grey', 'big_house_grey']),
    spriteScale: 1.0,
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
    spritesPerLevel: levelSpritesT(['well']),
    spriteScale: 1.0,
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
