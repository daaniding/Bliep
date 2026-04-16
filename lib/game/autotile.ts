/**
 * Multi-layer autotile for the antarcticbees coastline.
 *
 * The processed elevation grid has these values:
 *   0 = deep water
 *   1 = shallow water
 *   2 = sand/beach
 *   3 = grass (buildable)
 *   4 = river water
 *
 * We need multiple transition layers:
 *   sand → water  (rocky coastline)
 *   grass → sand   (soft edge into beach)
 *
 * Each autotile returns a 3×3 index (0-8):
 *   0=NW  1=N  2=NE
 *   3=W   4=C  5=E
 *   6=SW  7=S  8=SE
 */

export interface TileCell {
  col: number;
  row: number;
}

// ---- Elevation category helpers ----

/** Is this cell water (ocean, shallow, or river)? */
function isWaterish(v: number): boolean {
  return v === 0 || v === 1 || v === 4;
}

/** Is this cell solid ground (sand or grass)? */
function isGround(v: number): boolean {
  return v === 2 || v === 3;
}

// ---- 4-bit neighbor → 3×3 slot ----

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
// SAND → WATER coastline autotile
// ============================================================
/**
 * For sand cells (2): returns 0-8 index into coast[] tiles if this sand
 * cell borders water. Returns 4 (center) if surrounded by ground.
 * Returns null if this cell is not sand.
 */
export function sandToWaterIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  if (get(elev, gy, gx) !== 2) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  return neighborSlot(isWaterish(n), isWaterish(s), isWaterish(w), isWaterish(e));
}

// ============================================================
// GRASS → SAND transition autotile
// ============================================================
/**
 * For grass cells (3): returns 0-8 index into sandToGrass[] tiles if this
 * grass cell borders sand. Returns null if not grass or not bordering sand.
 * Returns 4 (center = no edge) if fully surrounded by grass.
 */
export function grassToSandIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  if (get(elev, gy, gx) !== 3) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const e = get(elev, gy, gx + 1);
  // Edge = neighbor is NOT grass (it's sand, water, or river)
  const edgeN = n !== 3;
  const edgeS = s !== 3;
  const edgeW = w !== 3;
  const edgeE = e !== 3;
  if (!edgeN && !edgeS && !edgeW && !edgeE) return null; // no edges, fully interior
  return neighborSlot(edgeN, edgeS, edgeW, edgeE);
}

// ============================================================
// Legacy compat: simple coast index (grass on water)
// Used by CityCanvas for basic rendering fallback.
// ============================================================
export function autotileCoastIndex(
  elev: number[][],
  gx: number,
  gy: number,
): number | null {
  const e = get(elev, gy, gx);
  if (isWaterish(e)) return null;
  const n = get(elev, gy - 1, gx);
  const s = get(elev, gy + 1, gx);
  const w = get(elev, gy, gx - 1);
  const eE = get(elev, gy, gx + 1);
  return neighborSlot(isWaterish(n), isWaterish(s), isWaterish(w), isWaterish(eE));
}

/** Legacy wrapper for old code. */
export function autotileGrassSlot(
  elev: number[][],
  gx: number,
  gy: number,
): TileCell | null {
  const idx = autotileCoastIndex(elev, gx, gy);
  if (idx === null) return null;
  return { col: idx % 3, row: Math.floor(idx / 3) };
}

/** Kept for API compat. */
export function shouldPaintCliffWall(): boolean {
  return false;
}
