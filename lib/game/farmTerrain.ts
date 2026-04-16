import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Antarcticbees Farm 4 Seasons tileset loader.
 *
 * The tileset is a 1200×720 PNG with 16×16 tiles (75 cols × 45 rows).
 * We extract individual tiles by (col, row) position.
 *
 * Tile coordinates are based on visual analysis of the tileset.
 * The tileset has these sections (roughly):
 *   Cols 0-15, Rows 0-10: Grass variants (3 shades) + edges
 *   Cols 0-8, Rows 11-18: Water + coast transitions
 *   Cols 9-20, Rows 0-10: Paths, cobblestone, dirt
 *   Cols 16-30, Rows 0-15: Tilled soil, crops area
 *   Right side: Buildings (multi-tile)
 *   Bottom: Trees, decorations, props
 */

const TILE = 16;
const TILESET_URL = '/assets/farm/tilesets/farm_spring_summer.png';

export interface FarmTerrain {
  sheet: Texture;
  /** Get a single 16×16 tile at (col, row) position in the sheet. */
  tile: (col: number, row: number) => Texture;
  /** Pre-extracted common tiles. */
  grass: Texture[];       // multiple grass variants
  grassDark: Texture[];   // darker grass
  water: Texture[];       // water tiles (animated frames)
  coastN: Texture;        // coast transitions
  coastS: Texture;
  coastE: Texture;
  coastW: Texture;
  coastNE: Texture;
  coastNW: Texture;
  coastSE: Texture;
  coastSW: Texture;
  coastInnerNE: Texture;
  coastInnerNW: Texture;
  coastInnerSE: Texture;
  coastInnerSW: Texture;
  pathH: Texture;
  pathV: Texture;
  pathCross: Texture;
  dirt: Texture;
  sand: Texture;
}

let cached: FarmTerrain | null = null;

export async function loadFarmTerrain(): Promise<FarmTerrain> {
  if (cached) return cached;

  const sheet = await Assets.load<Texture>(TILESET_URL);
  if (sheet.source) sheet.source.scaleMode = 'nearest';

  const tileCache = new Map<string, Texture>();

  function tile(col: number, row: number): Texture {
    const key = `${col},${row}`;
    let t = tileCache.get(key);
    if (!t) {
      t = new Texture({
        source: sheet.source,
        frame: new Rectangle(col * TILE, row * TILE, TILE, TILE),
      });
      tileCache.set(key, t);
    }
    return t;
  }

  // ---- Grass tiles ----
  // Based on the tileset: top-left area has grass in 3 shades
  // Each shade has a 3×3 autotile block + solid fill
  // Shade 1 (light): cols 0-4, rows 0-4
  // Shade 2 (medium): cols 5-9, rows 0-4
  // Shade 3 (dark): cols 10-14, rows 0-4
  const grass = [
    tile(1, 1), tile(2, 1), tile(1, 2), tile(2, 2), // light grass center variants
  ];
  const grassDark = [
    tile(6, 1), tile(7, 1), tile(6, 2), tile(7, 2), // darker grass center variants
  ];

  // ---- Water tiles ----
  // Water is in the lower-left section (blue area in explanations)
  // Animated: 4 frames side by side
  const water = [
    tile(0, 20), tile(1, 20), tile(2, 20), tile(3, 20),
  ];

  // ---- Coast transitions (grass → water edges) ----
  // These form a 3×3 block where edges transition from grass to water
  // Position depends on exact tileset layout — these are estimates
  // that I'll refine when I can see the result
  const coastRow = 17;
  const coastCol = 0;
  cached = {
    sheet,
    tile,
    grass,
    grassDark,
    water,
    coastN:  tile(coastCol + 1, coastRow),
    coastS:  tile(coastCol + 1, coastRow + 2),
    coastE:  tile(coastCol + 2, coastRow + 1),
    coastW:  tile(coastCol, coastRow + 1),
    coastNE: tile(coastCol + 2, coastRow),
    coastNW: tile(coastCol, coastRow),
    coastSE: tile(coastCol + 2, coastRow + 2),
    coastSW: tile(coastCol, coastRow + 2),
    coastInnerNE: tile(coastCol + 4, coastRow),
    coastInnerNW: tile(coastCol + 5, coastRow),
    coastInnerSE: tile(coastCol + 4, coastRow + 1),
    coastInnerSW: tile(coastCol + 5, coastRow + 1),
    pathH: tile(13, 1),
    pathV: tile(12, 2),
    pathCross: tile(13, 2),
    dirt: tile(18, 1),
    sand: tile(20, 1),
  };

  return cached;
}

export const FARM_TILE = TILE;
