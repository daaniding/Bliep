/**
 * 9-cell autotile lookup for the Tiny Swords 3×3 grass templates.
 *
 * Tilemap_color2.png contains two usable 3×3 templates:
 *   Flat grass   (sea-level, leafy edges, no cliff):  cols 0-2 rows 0-2
 *   Raised grass (plateau, cliff-overhang underneath): cols 4-6 rows 0-2
 *
 * A pure stone cliff-wall cell sits at col 5 row 5 — paint one of these
 * directly below each plateau south-coast cell to get the full 3D drop.
 *
 * Elevation values used by staticMap.ts:
 *   0 = water
 *   1 = sea-level grass (flat template)
 *   2 = plateau grass   (raised template + cliff wall south)
 */

export interface TileCell {
  col: number;
  row: number;
}

const FLAT_BASE = { col: 0, row: 0 };
const RAISED_BASE = { col: 4, row: 0 };

export const CLIFF_WALL_CELL: TileCell = { col: 5, row: 5 };

export function autotileGrassSlot(
  elev: number[][],
  gx: number,
  gy: number,
): TileCell | null {
  const e = elev[gy]?.[gx] ?? 0;
  if (e === 0) return null;

  const get = (y: number, x: number) => elev[y]?.[x] ?? 0;
  const n = get(gy - 1, gx);
  const s = get(gy + 1, gx);
  const w = get(gy, gx - 1);
  const eN = get(gy, gx + 1);

  // "Edge" = neighbor is strictly lower than the current cell. That's
  // where the grass template needs a leafy/cliff edge instead of interior.
  const edgeN = n < e;
  const edgeS = s < e;
  const edgeW = w < e;
  const edgeE = eN < e;

  let slotX = 1;
  let slotY = 1;
  if (edgeW) slotX = 0;
  if (edgeE) slotX = 2;
  if (edgeN) slotY = 0;
  if (edgeS) slotY = 2;

  const base = e >= 2 ? RAISED_BASE : FLAT_BASE;
  return { col: base.col + slotX, row: base.row + slotY };
}

/**
 * Returns true if we should paint a pure-stone cliff wall sprite at
 * (gx, gy + 1) because the current cell is a plateau whose south neighbor
 * is lower grass. Ignored when the south neighbor is water — there the
 * flat template already draws a leafy south edge.
 */
export function shouldPaintCliffWall(
  elev: number[][],
  gx: number,
  gy: number,
): boolean {
  const e = elev[gy]?.[gx] ?? 0;
  const s = elev[gy + 1]?.[gx] ?? 0;
  return e >= 2 && s > 0 && s < e;
}
