export const TILE_W = 96;
export const TILE_H = 48;
export const GRID_SIZE = 16;

export interface GridCoord {
  gx: number;
  gy: number;
}

export interface ScreenCoord {
  sx: number;
  sy: number;
}

export function gridToScreen(gx: number, gy: number, originX: number, originY: number): ScreenCoord {
  const sx = originX + (gx - gy) * (TILE_W / 2);
  const sy = originY + (gx + gy) * (TILE_H / 2);
  return { sx, sy };
}

export function screenToGrid(sx: number, sy: number, originX: number, originY: number): GridCoord {
  const dx = sx - originX;
  const dy = sy - originY;
  const gx = (dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2;
  const gy = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return { gx: Math.floor(gx), gy: Math.floor(gy) };
}

export function inBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE;
}

export function centerOrigin(viewW: number, viewH: number): { originX: number; originY: number } {
  const originX = viewW / 2;
  const originY = viewH / 2 - ((GRID_SIZE - 1) * TILE_H) / 2;
  return { originX, originY };
}
