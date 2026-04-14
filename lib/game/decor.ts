import { GRID_SIZE, BUILD_ZONE_RADIUS, CITY_CENTER, inBounds } from './iso';
import {
  TRPG_DECOR_TREES,
  TRPG_DECOR_BUSHES,
  TRPG_DECOR_ROCKS,
  TRPG_DECOR_MOUNTAINS,
} from './sprites';

export type DecorKind = 'tree' | 'rock' | 'mountain' | 'bush';

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

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Determine the decor kind for a tile based on its position relative to the
 * build zone. Outer ring = mountains, middle ring = mix of rocks + trees,
 * inner ring (just outside build zone) = mostly trees + bushes.
 */
function decorKindFor(distance: number, rand: () => number): DecorKind | null {
  const fromBuildEdge = distance - BUILD_ZONE_RADIUS;
  if (fromBuildEdge <= 0) return null;
  if (fromBuildEdge <= 1) {
    const r = rand();
    if (r < 0.5) return 'tree';
    if (r < 0.7) return 'bush';
    return null;
  }
  if (fromBuildEdge <= 3) {
    const r = rand();
    if (r < 0.55) return 'tree';
    if (r < 0.7) return 'bush';
    if (r < 0.85) return 'rock';
    return null;
  }
  // Outer rim — mountains and rocks
  const r = rand();
  if (r < 0.5) return 'mountain';
  if (r < 0.75) return 'rock';
  if (r < 0.9) return 'tree';
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
      const slugs =
        kind === 'tree' ? TRPG_DECOR_TREES :
        kind === 'bush' ? TRPG_DECOR_BUSHES :
        kind === 'rock' ? TRPG_DECOR_ROCKS :
        TRPG_DECOR_MOUNTAINS;
      const slug = pick(rand, slugs);
      const scale = kind === 'mountain' ? 1.15 + rand() * 0.25 : 0.9 + rand() * 0.2;
      tiles.push({ gx, gy, kind, slug, scale });
    }
  }
  return tiles;
}

/** Tiles that are part of the road into the city (no buildings, no decor). */
export function isRoadTile(gx: number, gy: number): boolean {
  return gy === CITY_CENTER.gy && gx < CITY_CENTER.gx - BUILD_ZONE_RADIUS && gx >= 0;
}
