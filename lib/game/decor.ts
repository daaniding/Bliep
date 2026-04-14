import { GRID_SIZE, BUILD_ZONE_RADIUS, CITY_CENTER, inBounds } from './iso';

export type DecorKind = 'tree' | 'rock' | 'mountain' | 'bush' | 'flower';

export interface DecorTile {
  gx: number;
  gy: number;
  kind: DecorKind;
  slug: string;
  scale: number;
}

const TREE_SLUGS = ['oak_tree', 'tree_emerald_1', 'tree_emerald_2', 'tree_emerald_3', 'tree_emerald_4'];
const SMALL_TREE_SLUGS = ['oak_tree_small'];
const BUSH_SLUGS = ['bush_emerald_1', 'bush_emerald_2', 'bush_emerald_3', 'bush_emerald_4', 'bush_emerald_5'];
const ROCK_SLUGS = ['rock_brown_1', 'rock_brown_2', 'rock_brown_4', 'rock_brown_6', 'rock_brown_9'];
const FLOWER_SLUGS = ['flowers_red', 'flowers_white'];
const MOUNTAIN_SLUGS = ['rock_brown_6', 'rock_brown_9'];

function lcg(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function decorKindFor(distance: number, rand: () => number): DecorKind | null {
  const fromBuildEdge = distance - BUILD_ZONE_RADIUS;
  if (fromBuildEdge <= 0) return null;
  if (fromBuildEdge <= 1) {
    // Edge ring — light scatter of bushes + flowers + a few trees
    const r = rand();
    if (r < 0.55) return 'tree';
    if (r < 0.78) return 'bush';
    if (r < 0.92) return 'flower';
    return null;
  }
  if (fromBuildEdge <= 3) {
    // Forest band — dense
    const r = rand();
    if (r < 0.7) return 'tree';
    if (r < 0.85) return 'bush';
    if (r < 0.94) return 'rock';
    return null;
  }
  // Outer rim — solid forest + rocks (almost no gaps)
  const r = rand();
  if (r < 0.65) return 'tree';
  if (r < 0.82) return 'bush';
  if (r < 0.93) return 'rock';
  return null;
}

export function seedDecor(seed: number): DecorTile[] {
  const rand = lcg(seed || 1);
  const tiles: DecorTile[] = [];
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      if (!inBounds(gx, gy)) continue;
      const dx = gx - CITY_CENTER.gx;
      const dy = gy - CITY_CENTER.gy;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      // Reserve a road into town
      if (gy === CITY_CENTER.gy && gx < CITY_CENTER.gx - BUILD_ZONE_RADIUS) continue;
      const kind = decorKindFor(dist, rand);
      if (!kind) continue;
      let slug: string;
      switch (kind) {
        case 'tree':     slug = pick(rand, rand() < 0.2 ? SMALL_TREE_SLUGS : TREE_SLUGS); break;
        case 'bush':     slug = pick(rand, BUSH_SLUGS); break;
        case 'rock':     slug = pick(rand, ROCK_SLUGS); break;
        case 'flower':   slug = pick(rand, FLOWER_SLUGS); break;
        case 'mountain': slug = pick(rand, MOUNTAIN_SLUGS); break;
      }
      const scale = kind === 'mountain' ? 1.4 + rand() * 0.4 : 0.9 + rand() * 0.3;
      tiles.push({ gx, gy, kind, slug, scale });
    }
  }
  return tiles;
}

export function isRoadTile(gx: number, gy: number): boolean {
  return gy === CITY_CENTER.gy && gx < CITY_CENTER.gx - BUILD_ZONE_RADIUS && gx >= 0;
}
