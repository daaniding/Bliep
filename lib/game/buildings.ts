export type BuildingType = 'house' | 'farm' | 'barracks' | 'wall';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  description: string;
  levels: Array<{ cost: number }>;
  maxLevel: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  house: {
    type: 'house',
    name: 'Huis',
    description: 'Bevolking voor je stad.',
    levels: [{ cost: 50 }, { cost: 150 }, { cost: 400 }],
    maxLevel: 3,
  },
  farm: {
    type: 'farm',
    name: 'Boerderij',
    description: 'Produceert passief coins.',
    levels: [{ cost: 100 }, { cost: 300 }, { cost: 800 }],
    maxLevel: 3,
  },
  barracks: {
    type: 'barracks',
    name: 'Kazerne',
    description: 'Straks: troepen trainen.',
    levels: [{ cost: 200 }, { cost: 600 }, { cost: 1500 }],
    maxLevel: 3,
  },
  wall: {
    type: 'wall',
    name: 'Muur',
    description: 'Straks: verdediging.',
    levels: [{ cost: 30 }, { cost: 80 }, { cost: 200 }],
    maxLevel: 3,
  },
};

export const BUILDING_ORDER: BuildingType[] = ['house', 'farm', 'barracks', 'wall'];

export function buildCost(type: BuildingType): number {
  return BUILDINGS[type].levels[0].cost;
}

export function upgradeCost(type: BuildingType, currentLevel: number): number | null {
  const def = BUILDINGS[type];
  if (currentLevel >= def.maxLevel) return null;
  return def.levels[currentLevel].cost;
}
