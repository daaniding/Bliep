// Top-down grid math (file kept named iso.ts for import compat — Bliep
// switched from isometric to top-down view in stad v2).

export const TILE_W = 64;
export const TILE_H = 64;
export const GRID_SIZE = 32;

export interface GridCoord { gx: number; gy: number }
export interface ScreenCoord { sx: number; sy: number }

export function gridToScreen(gx: number, gy: number, originX: number, originY: number): ScreenCoord {
  return { sx: originX + gx * TILE_W + TILE_W / 2, sy: originY + gy * TILE_H + TILE_H / 2 };
}

export function screenToGrid(sx: number, sy: number, originX: number, originY: number): GridCoord {
  return {
    gx: Math.floor((sx - originX) / TILE_W),
    gy: Math.floor((sy - originY) / TILE_H),
  };
}

export function inBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE;
}

export function centerOrigin(viewW: number, viewH: number): { originX: number; originY: number } {
  return {
    originX: viewW / 2 - (GRID_SIZE * TILE_W) / 2,
    originY: viewH / 2 - (GRID_SIZE * TILE_H) / 2,
  };
}

export const CITY_CENTER = { gx: Math.floor(GRID_SIZE / 2), gy: Math.floor(GRID_SIZE / 2) };
export const BUILD_ZONE_RADIUS = 12;

export function inBuildZone(gx: number, gy: number): boolean {
  const dx = gx - CITY_CENTER.gx;
  const dy = gy - CITY_CENTER.gy;
  return inBounds(gx, gy) && Math.max(Math.abs(dx), Math.abs(dy)) <= BUILD_ZONE_RADIUS;
}
