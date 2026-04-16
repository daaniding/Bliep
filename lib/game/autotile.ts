/**
 * 4-bit autotile for the antarcticbees coastline.
 *
 * Checks the 4 cardinal neighbours (N, S, E, W) of each land cell.
 * Where a neighbour is water (elevation 0), the cell needs an edge tile.
 * The result is an index into FarmTerrain.coast[] (0-8), which maps:
 *
 *   0=NW  1=N  2=NE
 *   3=W   4=C  5=E
 *   6=SW  7=S  8=SE
 *
 * For fully interior cells (no water neighbour), returns index 4 (center).
 *
 * Elevation values (staticMap.ts):
 *   0 = water
 *   1 = grass (buildable land)
 */

export interface TileCell {
  col: number;
  row: number;
}

/**
 * Returns an index (0-8) into the coast[] array for the given cell.
 * Returns null if the cell itself is water (elevation 0).
 */
export function autotileCoastIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  const e = elev[gy]?.[gx] ?? 0;
  if (e === 0) return null; // water cell — no grass tile

  const get = (y: number, x: number) => elev[y]?.[x] ?? 0;
  const n = get(gy - 1, gx);
  const s = get(gy + 1, gx);
  const w = get(gy, gx - 1);
  const eN = get(gy, gx + 1);

  // Edge flags: true when neighbour is water (lower)
  const edgeN = n === 0;
  const edgeS = s === 0;
  const edgeW = w === 0;
  const edgeE = eN === 0;

  // Map to 3×3 grid slot (slotX=col, slotY=row)
  // Default = center (1,1)
  let slotX = 1; // 0=left, 1=center, 2=right
  let slotY = 1; // 0=top,  1=middle, 2=bottom
  if (edgeW) slotX = 0;
  if (edgeE) slotX = 2;
  if (edgeN) slotY = 0;
  if (edgeS) slotY = 2;

  return slotY * 3 + slotX; // 0-8 index
}

/**
 * Legacy wrapper: returns {col, row} for backward compat with old code.
 * col/row here are the 3×3 slot (0-2, 0-2), NOT tileset pixel coords.
 */
export function autotileGrassSlot(
  elev: number[][],
  gx: number,
  gy: number,
): TileCell | null {
  const idx = autotileCoastIndex(elev, gx, gy);
  if (idx === null) return null;
  return { col: idx % 3, row: Math.floor(idx / 3) };
}

/**
 * Check if a water cell should show an inner-corner overlay.
 * An inner corner exists when a water cell has grass on two adjacent
 * cardinal sides (forming an L-shape of grass around it).
 *
 * Returns an array of corner indices (0=NW, 1=NE, 2=SW, 3=SE)
 * to render from coastInner[].
 */
export function innerCorners(
  elev: number[][],
  gx: number,
  gy: number,
): number[] {
  const e = elev[gy]?.[gx] ?? 0;
  if (e !== 0) return []; // only for water cells

  const get = (y: number, x: number) => (elev[y]?.[x] ?? 0) > 0;
  const n = get(gy - 1, gx);
  const s = get(gy + 1, gx);
  const w = get(gy, gx - 1);
  const eE = get(gy, gx + 1);

  const corners: number[] = [];
  // NW inner: grass to N AND W
  if (n && w) corners.push(0);
  // NE inner: grass to N AND E
  if (n && eE) corners.push(1);
  // SW inner: grass to S AND W
  if (s && w) corners.push(2);
  // SE inner: grass to S AND E
  if (s && eE) corners.push(3);

  return corners;
}

/**
 * Returns true if we should paint a cliff wall under a plateau cell.
 * Currently unused (no plateau in antarcticbees), kept for API compat.
 */
export function shouldPaintCliffWall(
  elev: number[][],
  gx: number,
  gy: number,
): boolean {
  return false;
}
