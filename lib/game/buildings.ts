export type BuildingType = 'house' | 'farm' | 'barracks' | 'wall' | 'tower' | 'fountain' | 'tree' | 'path';

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
 * Build a 10-element sprite list from explicit per-level slugs. Pass exactly
 * 10 entries — one per level. Lets the catalogue hand-pick Tiny Swords colors
 * and sizes per level breakpoint.
 */
function lvls(...slugs: string[]): string[] {
  if (slugs.length !== MAX_LEVEL) {
    // Fill out by repeating the last entry
    const out = [...slugs];
    while (out.length < MAX_LEVEL) out.push(slugs[slugs.length - 1] ?? slugs[0]);
    return out;
  }
  return slugs;
}

// Tiny Swords slug shorthand
const ts = (color: string, kind: string) => `ts:${color}:${kind}`;

/**
 * 10-level sprite progression: each building scales through Tiny Swords
 * size + color. Intent:
 *  - Levels 1-3:  small variant in YELLOW (basic wood)
 *  - Levels 4-6:  medium variant in BLUE  (worked stone)
 *  - Levels 7-9:  large variant in PURPLE (royal)
 *  - Level 10:    legendary variant in BLACK (elite)
 *
 * For house: house1 → house2 → house3 + color upgrade.
 * For barracks/tower/etc: same building kind, color upgrade per level.
 * Castle is reserved for the top tier of `house` (city hall feel).
 */
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
    spritesPerLevel: lvls(
      ts('yellow', 'house1'), ts('yellow', 'house2'), ts('yellow', 'house3'),
      ts('blue', 'house1'),   ts('blue', 'house2'),   ts('blue', 'house3'),
      ts('purple', 'house1'), ts('purple', 'house2'), ts('purple', 'house3'),
      ts('black', 'castle'),
    ),
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
    spritesPerLevel: lvls(
      ts('yellow', 'house2'), ts('yellow', 'house3'), ts('yellow', 'monastery'),
      ts('blue', 'house2'),   ts('blue', 'house3'),   ts('blue', 'monastery'),
      ts('purple', 'monastery'), ts('purple', 'monastery'),
      ts('red', 'monastery'), ts('red', 'monastery'),
    ),
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
    spritesPerLevel: lvls(
      ts('yellow', 'barracks'), ts('yellow', 'barracks'), ts('yellow', 'barracks'),
      ts('blue', 'barracks'),   ts('blue', 'barracks'),   ts('blue', 'barracks'),
      ts('purple', 'barracks'), ts('purple', 'barracks'), ts('red', 'barracks'),
      ts('black', 'barracks'),
    ),
    troopsPerLevel: [2, 4, 7, 11, 16, 22, 30, 40, 52, 70],
    spriteScale: 1.1,
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
    spritesPerLevel: lvls(
      ts('yellow', 'tower'), ts('yellow', 'tower'), ts('yellow', 'tower'),
      ts('blue', 'tower'),   ts('blue', 'tower'),   ts('blue', 'tower'),
      ts('purple', 'tower'), ts('purple', 'tower'), ts('red', 'tower'),
      ts('black', 'tower'),
    ),
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
    spritesPerLevel: lvls(
      ts('yellow', 'archery'), ts('yellow', 'archery'), ts('yellow', 'archery'),
      ts('blue', 'archery'),   ts('blue', 'archery'),   ts('blue', 'archery'),
      ts('purple', 'archery'), ts('purple', 'archery'), ts('red', 'archery'),
      ts('black', 'archery'),
    ),
    spriteScale: 1.1,
  },
  fountain: {
    type: 'fountain',
    name: 'Monastery',
    description: 'Decoratie + city allure. Schaalt cosmetics.',
    baseCost: 75,
    costGrowth: 1.4,
    baseBuildSec: 25,
    buildTimeGrowth: 1.5,
    maxLevel: MAX_LEVEL,
    spritesPerLevel: lvls(
      ts('yellow', 'monastery'), ts('yellow', 'monastery'),
      ts('blue', 'monastery'),   ts('blue', 'monastery'),
      ts('purple', 'monastery'), ts('purple', 'monastery'),
      ts('red', 'monastery'),    ts('red', 'monastery'),
      ts('black', 'monastery'),  ts('black', 'monastery'),
    ),
    spriteScale: 1.05,
  },
  tree: {
    type: 'tree',
    name: 'Boom',
    description: 'Decoratie. Plant een boom op een lege grastegel.',
    baseCost: 5,
    costGrowth: 1.2,
    baseBuildSec: 1,
    buildTimeGrowth: 1,
    maxLevel: 1,
    // Sprite slug handled specially in CityCanvas rendering — uses a
    // Tiny Swords tree frame instead of a ts:color:kind slug.
    spritesPerLevel: lvls('decor:tree', 'decor:tree', 'decor:tree', 'decor:tree', 'decor:tree',
                          'decor:tree', 'decor:tree', 'decor:tree', 'decor:tree', 'decor:tree'),
    spriteScale: 1.4,
  },
  path: {
    type: 'path',
    name: 'Pad',
    description: 'Zandpad tussen tegels. Geen effect, puur cosmetisch.',
    baseCost: 2,
    costGrowth: 1.1,
    baseBuildSec: 1,
    buildTimeGrowth: 1,
    maxLevel: 1,
    spritesPerLevel: lvls('decor:path', 'decor:path', 'decor:path', 'decor:path', 'decor:path',
                          'decor:path', 'decor:path', 'decor:path', 'decor:path', 'decor:path'),
    spriteScale: 1.0,
  },
};

export const BUILDING_ORDER: BuildingType[] = ['house', 'farm', 'barracks', 'tower', 'wall', 'fountain', 'tree', 'path'];

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
