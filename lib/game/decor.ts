import { GRID_SIZE, BUILD_ZONE_RADIUS, CITY_CENTER, inBounds } from './iso';
import { ENV_SLUGS } from './sprites';

export type DecorKind = 'tree' | 'rock' | 'mountain';

export interface DecorTile {
  gx: number;
  gy: number;
  kind: DecorKind;
  slug: string;
  scale: number;
}

// Tiny LCG so the same seed -> same decor layout.
function lcg(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Pick which Kenney environment sprite represents which decor kind.
 * The Kenney environment pack has trees, rocks, ferns, mountains in a single
 * folder. We carve them up by index ranges.
 */
const TREE_SLUGS = ENV_SLUGS.slice(0, 8);    // 01–08
const ROCK_SLUGS = ENV_SLUGS.slice(8, 14);   // 09–14
const MOUNTAIN_SLUGS = ENV_SLUGS.slice(14);  // 15–21

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Determine the decor kind for a tile based on its position relative to the
 * build zone. Outer ring = mountains, middle ring = mix of rocks + trees,
 * inner ring (just outside build zone) = mostly trees.
 */
function decorKindFor(distance: number, rand: () => number): DecorKind | null {
  const fromBuildEdge = distance - BUILD_ZONE_RADIUS;
  if (fromBuildEdge <= 0) return null;
  if (fromBuildEdge <= 1) {
    // Just outside the buildable zone — light forest, sparse
    return rand() < 0.55 ? 'tree' : null;
  }
  if (fromBuildEdge <= 3) {
    // Forest band
    const r = rand();
    if (r < 0.65) return 'tree';
    if (r < 0.8) return 'rock';
    return null;
  }
  // Outer rim — mountains and rocks
  const r = rand();
  if (r < 0.5) return 'mountain';
  if (r < 0.75) return 'rock';
  if (r < 0.85) return 'tree';
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
      // Reserve a horizontal "road into town" along center y axis on west side
      if (gy === CITY_CENTER.gy && gx < CITY_CENTER.gx - BUILD_ZONE_RADIUS) {
        // road tile, no decor
        continue;
      }
      const kind = decorKindFor(dist, rand);
      if (!kind) continue;
      const slugs = kind === 'tree' ? TREE_SLUGS : kind === 'rock' ? ROCK_SLUGS : MOUNTAIN_SLUGS;
      const slug = pick(rand, slugs);
      const scale = kind === 'mountain' ? 1.2 + rand() * 0.3 : 0.85 + rand() * 0.25;
      tiles.push({ gx, gy, kind, slug, scale });
    }
  }
  return tiles;
}

/** Tiles that are part of the road into the city (no buildings, no decor). */
export function isRoadTile(gx: number, gy: number): boolean {
  return gy === CITY_CENTER.gy && gx < CITY_CENTER.gx - BUILD_ZONE_RADIUS && gx >= 0;
}
