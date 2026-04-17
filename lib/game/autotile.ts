/**
 * Autotile for coast tiles.
 *
 * Coast tiles go on GRASS cells that border water.
 * Each coast tile already contains both the grass top
 * and the rocky cliff edge — one tile does the transition.
 *
 * Returns 0-8 index into the 3×3 coast tile array:
 *   0=NW  1=N  2=NE
 *   3=W   4=C  5=E
 *   6=SW  7=S  8=SE
 */

export interface TileCell { col: number; row: number; }

function isWater(v: number): boolean {
  return v === 0 || v === 1 || v === 4;
}

function get(elev: number[][], gy: number, gx: number): number {
  return elev[gy]?.[gx] ?? 0;
}

/**
 * For grass cells (3) adjacent to water: returns 0-8 coast tile index.
 * Returns null if cell is water or not bordering water.
 */
export function autotileCoastIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  const v = get(elev, gy, gx);
  if (v !== 3) return null;

  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);

  const wN = isWater(n), wS = isWater(s), wW = isWater(w), wE = isWater(e);
  if (!wN && !wS && !wW && !wE) return null; // no water neighbors

  let slotX = 1, slotY = 1;
  if (wW) slotX = 0;
  if (wE) slotX = 2;
  if (wN) slotY = 0;
  if (wS) slotY = 2;
  return slotY * 3 + slotX;
}

/**
 * Check inner corners: grass cell where no cardinal neighbor is water
 * but a diagonal neighbor IS water.
 * Returns 'NW'|'NE'|'SW'|'SE' or null.
 */
export function coastInnerCorner(
  elev: number[][],
  gx: number,
  gy: number,
): 'NW' | 'NE' | 'SW' | 'SE' | null {
  const v = get(elev, gy, gx);
  if (v !== 3) return null;

  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  if (isWater(n) || isWater(s) || isWater(w) || isWater(e)) return null;

  const nw = get(elev, gy - 1, gx - 1);
  const ne = get(elev, gy - 1, gx + 1);
  const sw = get(elev, gy + 1, gx - 1);
  const se = get(elev, gy + 1, gx + 1);

  if (isWater(nw)) return 'NW';
  if (isWater(ne)) return 'NE';
  if (isWater(sw)) return 'SW';
  if (isWater(se)) return 'SE';
  return null;
}

// Legacy compat
export function autotileGrassSlot(elev: number[][], gx: number, gy: number): TileCell | null {
  const idx = autotileCoastIndex(elev, gx, gy);
  if (idx === null) return null;
  return { col: idx % 3, row: Math.floor(idx / 3) };
}

export function shouldPaintCliffWall(): boolean { return false; }
