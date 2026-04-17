/**
 * Multi-layer autotile for the antarcticbees coastline.
 *
 * Elevation grid values:
 *   0 = deep water
 *   1 = shallow water
 *   2 = cliff/coast (rocky border)
 *   3 = grass (buildable)
 *   4 = lake water
 *
 * Transitions:
 *   cliff → water  (rocky coastline autotile)
 *   grass → cliff  (grass-to-cliff edge, uses sand-to-grass tiles)
 */

export interface TileCell {
  col: number;
  row: number;
}

/** Is this cell any kind of water? */
function isWater(v: number): boolean {
  return v === 0 || v === 1 || v === 4;
}

function neighborSlot(edgeN: boolean, edgeS: boolean, edgeW: boolean, edgeE: boolean): number {
  let slotX = 1;
  let slotY = 1;
  if (edgeW) slotX = 0;
  if (edgeE) slotX = 2;
  if (edgeN) slotY = 0;
  if (edgeS) slotY = 2;
  return slotY * 3 + slotX;
}

function get(elev: number[][], gy: number, gx: number): number {
  return elev[gy]?.[gx] ?? 0;
}

// ============================================================
// CLIFF → WATER coastline autotile
// ============================================================
/**
 * For cliff cells (2): returns 0-8 index into coast[] tiles.
 * The coast tile is chosen based on which neighbors are water.
 * Returns 4 (center) if fully surrounded by land.
 */
export function cliffToWaterIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  if (get(elev, gy, gx) !== 2) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  return neighborSlot(isWater(n), isWater(s), isWater(w), isWater(e));
}

/**
 * Check if a cliff cell has a diagonal water neighbor but no cardinal water.
 * Returns the inner corner direction or null.
 */
export function cliffInnerCorner(
  elev: number[][],
  gx: number,
  gy: number,
): 'NW' | 'NE' | 'SW' | 'SE' | null {
  if (get(elev, gy, gx) !== 2) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  // Only inner corners when no cardinal neighbor is water
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

// ============================================================
// GRASS → CLIFF transition autotile
// ============================================================
/**
 * For grass cells (3): returns 0-8 index into sandToGrass[] tiles
 * if this grass cell borders cliff (2). Provides a soft grass-to-cliff edge.
 */
export function grassToCliffIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  if (get(elev, gy, gx) !== 3) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  // Edge = neighbor is cliff, water, or lake (not grass)
  const edgeN = n !== 3;
  const edgeS = s !== 3;
  const edgeW = w !== 3;
  const edgeE = e !== 3;
  if (!edgeN && !edgeS && !edgeW && !edgeE) return null;
  return neighborSlot(edgeN, edgeS, edgeW, edgeE);
}

// ============================================================
// Legacy compat
// ============================================================
export function autotileCoastIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  const e = get(elev, gy, gx);
  if (isWater(e)) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const eE = get(elev, gy, gx + 1);
  return neighborSlot(isWater(n), isWater(s), isWater(w), isWater(eE));
}

export function autotileGrassSlot(
  elev: number[][],
  gx: number,
  gy: number,
): TileCell | null {
  const idx = autotileCoastIndex(elev, gx, gy);
  if (idx === null) return null;
  return { col: idx % 3, row: Math.floor(idx / 3) };
}

export function shouldPaintCliffWall(): boolean {
  return false;
}
