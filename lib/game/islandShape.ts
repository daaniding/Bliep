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

export interface Plateau {
  cx: number;
  cy: number;
  baseRadius: number;
  noiseAmps: number[];
  noisePhases: number[];
}

export interface WorldMask {
  islands: Island[];
  plateau: Plateau;
  grid: Uint8Array;
  plateauGrid: Uint8Array;
  isLand(gx: number, gy: number): boolean;
  isPlateau(gx: number, gy: number): boolean;
  isPlateauSouthCoast(gx: number, gy: number): boolean;
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

function inBlob(
  cx: number,
  cy: number,
  baseRadius: number,
  noiseAmps: number[],
  noisePhases: number[],
  gx: number,
  gy: number,
): boolean {
  const dx = gx - cx;
  const dy = gy - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  let radius = baseRadius;
  for (let i = 0; i < noiseAmps.length; i++) {
    const freq = i + 2;
    radius += Math.sin(angle * freq + noisePhases[i]) * noiseAmps[i];
  }
  return dist < radius;
}

function inIsland(island: Island, gx: number, gy: number): boolean {
  return inBlob(island.cx, island.cy, island.baseRadius, island.noiseAmps, island.noisePhases, gx, gy);
}

/**
 * Generate the world: one main island at the grid center + several themed
 * mini islands scattered around it in the water ring. Deterministic given
 * the same seed.
 */
export function generateWorld(seed: number): WorldMask {
  const rand = lcg(seed);
  const islands: Island[] = [];

  // Main island — a smaller, denser organic blob. Quarter of the previous
  // radius so the player's build area stays intimate. Noise amps scaled
  // down proportionally so the coastline still reads as organic.
  islands.push({
    idx: 0,
    cx: Math.floor(GRID_SIZE / 2),
    cy: Math.floor(GRID_SIZE / 2),
    baseRadius: 16,
    noiseAmps: [3.5, 2.2, 1.4, 0.8],
    noisePhases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
    theme: 'main',
    locked: false,
  });

  // Mini islands removed — future multi-island switcher becomes a separate
  // scene, not adjacent blobs on the same grid.

  // Inner plateau — raised blob inside the main island, roughly 1/3 the
  // radius, offset slightly north-west of the island center so the plateau
  // south-cliff faces open grass (buildings can sit around it).
  const main = islands[0];
  const plateau: Plateau = {
    cx: main.cx - 2,
    cy: main.cy - 3,
    baseRadius: Math.max(4, Math.round(main.baseRadius * 0.42)),
    noiseAmps: [1.2, 0.8, 0.5],
    noisePhases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
  };

  // Precompute the land grid: for each cell, store (island index + 1) or 0 for water.
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const plateauGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let i = 0; i < islands.length; i++) {
        if (inIsland(islands[i], gx, gy)) {
          grid[gy * GRID_SIZE + gx] = i + 1;
          // Plateau cells must also be inside the main island.
          if (
            i === 0 &&
            inBlob(plateau.cx, plateau.cy, plateau.baseRadius, plateau.noiseAmps, plateau.noisePhases, gx, gy)
          ) {
            plateauGrid[gy * GRID_SIZE + gx] = 1;
          }
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

  const isPlateau = (gx: number, gy: number) => {
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return false;
    return plateauGrid[gy * GRID_SIZE + gx] === 1;
  };

  const isPlateauSouthCoast = (gx: number, gy: number) =>
    isPlateau(gx, gy) && !isPlateau(gx, gy + 1);

  return {
    islands,
    plateau,
    grid,
    plateauGrid,
    isLand,
    isPlateau,
    isPlateauSouthCoast,
    islandAt,
    isSouthCoast,
    isAnyCoast,
    cellsOfIsland,
  };
}
