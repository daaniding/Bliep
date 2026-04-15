import { GRID_SIZE } from './iso';

export type IslandTheme = 'main' | 'forest' | 'gold' | 'meat' | 'rocks' | 'duck';

export interface Island {
  idx: number;
  cx: number;
  cy: number;
  baseRadius: number;
  noiseAmps: number[];
  noisePhases: number[];
  theme: IslandTheme;
  locked: boolean;
}

export interface WorldMask {
  islands: Island[];
  grid: Uint8Array;
  isLand(gx: number, gy: number): boolean;
  islandAt(gx: number, gy: number): Island | null;
  isSouthCoast(gx: number, gy: number): boolean;
  isAnyCoast(gx: number, gy: number): boolean;
  cellsOfIsland(island: Island): Array<{ gx: number; gy: number }>;
}

function lcg(seed: number) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function inIsland(island: Island, gx: number, gy: number): boolean {
  const dx = gx - island.cx;
  const dy = gy - island.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  let radius = island.baseRadius;
  for (let i = 0; i < island.noiseAmps.length; i++) {
    const freq = i + 2;
    radius += Math.sin(angle * freq + island.noisePhases[i]) * island.noiseAmps[i];
  }
  return dist < radius;
}

/**
 * Generate the world: one main island at the grid center + several themed
 * mini islands scattered around it in the water ring. Deterministic given
 * the same seed.
 */
export function generateWorld(seed: number): WorldMask {
  const rand = lcg(seed);
  const islands: Island[] = [];

  // Main island — big organic blob at the center.
  islands.push({
    idx: 0,
    cx: Math.floor(GRID_SIZE / 2),
    cy: Math.floor(GRID_SIZE / 2),
    baseRadius: 62,
    noiseAmps: [12, 8, 5, 3],
    noisePhases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
    theme: 'main',
    locked: false,
  });

  // Mini islands — one per theme, placed around the main island.
  const miniThemes: IslandTheme[] = ['forest', 'gold', 'meat', 'rocks', 'duck'];
  const mainCx = islands[0].cx;
  const mainCy = islands[0].cy;
  const mainMaxR = islands[0].baseRadius + 15; // safety margin outside noise bumps

  // Distribute minis roughly evenly around the main island.
  const angleStep = (Math.PI * 2) / miniThemes.length;
  let angleOffset = rand() * Math.PI * 2;

  for (let i = 0; i < miniThemes.length; i++) {
    const theme = miniThemes[i];
    // Each mini sits in the water ring outside the main island.
    const ringDist = mainMaxR + 18 + rand() * 12; // distance from main center
    const angle = angleOffset + i * angleStep + (rand() - 0.5) * 0.4;
    const cx = Math.round(mainCx + Math.cos(angle) * ringDist);
    const cy = Math.round(mainCy + Math.sin(angle) * ringDist);

    const baseRadius = theme === 'duck' ? 10 + rand() * 3 : 13 + rand() * 5;

    islands.push({
      idx: i + 1,
      cx,
      cy,
      baseRadius,
      noiseAmps: [3 + rand() * 2, 2 + rand() * 2, 1.5 + rand()],
      noisePhases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
      theme,
      locked: true,
    });
  }

  // Precompute the land grid: for each cell, store (island index + 1) or 0 for water.
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let i = 0; i < islands.length; i++) {
        if (inIsland(islands[i], gx, gy)) {
          grid[gy * GRID_SIZE + gx] = i + 1;
          break;
        }
      }
    }
  }

  const at = (gx: number, gy: number) => {
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return 0;
    return grid[gy * GRID_SIZE + gx];
  };

  const isLand = (gx: number, gy: number) => at(gx, gy) > 0;

  const islandAt = (gx: number, gy: number): Island | null => {
    const v = at(gx, gy);
    return v === 0 ? null : islands[v - 1];
  };

  const isSouthCoast = (gx: number, gy: number) =>
    isLand(gx, gy) && !isLand(gx, gy + 1);

  const isAnyCoast = (gx: number, gy: number) =>
    isLand(gx, gy) &&
    (!isLand(gx + 1, gy) || !isLand(gx - 1, gy) || !isLand(gx, gy + 1) || !isLand(gx, gy - 1));

  const cellsOfIsland = (island: Island) => {
    const out: Array<{ gx: number; gy: number }> = [];
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (grid[gy * GRID_SIZE + gx] === island.idx + 1) out.push({ gx, gy });
      }
    }
    return out;
  };

  return { islands, grid, isLand, islandAt, isSouthCoast, isAnyCoast, cellsOfIsland };
}
