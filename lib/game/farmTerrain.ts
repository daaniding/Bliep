/**
 * Antarcticbees "Farm 4 Seasons" terrain loader.
 *
 * Source tileset: farm_spring_summer.png (1200×720, 75×45 cells of 16px).
 * Replaces tinyswordsTerrain.ts entirely.
 *
 * 16px source tiles are rendered at 64px on-screen (4× nearest-neighbor
 * scale) to match TILE_W/TILE_H = 64.
 *
 * ---- Tileset key regions (16px tile grid coords) ----
 *
 * COASTLINE AUTOTILE (grass island on water, 3×3 shore tiles):
 *   Cols 1-3, Rows 22-24    (standard 3×3: NW N NE / W C E / SW S SE)
 *   Inner corners at cols 5-8, rows 21-24
 *   Solid water fill: col 0, row 21
 *
 * GRASS INTERIOR (solid fill variations):
 *   Various shades at cols 6-7 rows 22-23 (bright)
 *   More at cols 10-11 rows 22-23
 *
 * DIRT/PATH: cols 15-17 rows 36-38 (sand on dark grass)
 *
 * BUILDINGS: right side of tileset (cols 40+)
 * TREES: top-left (cols 0-19, rows 0-7) + standalone sprite sheets
 */

import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/farm';
const TILE = 16;

export interface AnimatedSheet {
  frames: Texture[];
  frameW: number;
  frameH: number;
}

export interface FarmTerrain {
  /** The raw tileset texture (for custom slicing). */
  tileset: Texture;

  /** Solid water fill tile (16×16). */
  water: Texture;

  /**
   * Coastline 3×3 autotile: grass island on water.
   * Index: [NW, N, NE, W, C, E, SW, S, SE] = 9 tiles.
   * Maps directly to the 4-bit autotile slot system.
   */
  coast: Texture[];

  /**
   * Inner-corner coast tiles (concave water-into-grass).
   * [NW, NE, SW, SE]
   */
  coastInner: Texture[];

  /** Interior grass fill variations for center tiles. */
  grass: Texture[];

  /** 3×3 path/sand autotile on grass. */
  path: Texture[];

  /** Animated tree sprites from separate sheet files. */
  trees: AnimatedSheet[];

  /** Cloud sprites (borrowed from Tiny Swords). */
  clouds: Texture[];

  /** Building sprites keyed by slug. */
  buildings: Map<string, Texture>;

  /** Utility: cut any 16px tile by grid coord. */
  tile: (col: number, row: number) => Texture;

  /** Utility: cut a pixel-rect from the tileset. */
  rect: (x: number, y: number, w: number, h: number) => Texture;
}

let cached: FarmTerrain | null = null;

function nearest(t: Texture | null) {
  if (t?.source) t.source.scaleMode = 'nearest';
}

async function safeLoad(url: string): Promise<Texture | null> {
  try { return await Assets.load<Texture>(url); }
  catch { return null; }
}

function sliceFrames(tex: Texture, fw: number, fh: number, n: number): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * fw, 0, fw, fh),
    }));
  }
  return out;
}

export async function loadFarmTerrain(): Promise<FarmTerrain> {
  if (cached) return cached;

  const tileset = await Assets.load<Texture>(`${BASE}/tilesets/farm_spring_summer.png`);
  nearest(tileset);

  // ---- Tile helpers ----
  const tileCache = new Map<string, Texture>();
  const tile = (col: number, row: number): Texture => {
    const key = `${col},${row}`;
    let t = tileCache.get(key);
    if (!t) {
      t = new Texture({
        source: tileset.source,
        frame: new Rectangle(col * TILE, row * TILE, TILE, TILE),
      });
      nearest(t);
      tileCache.set(key, t);
    }
    return t;
  };

  const rect = (x: number, y: number, w: number, h: number): Texture => {
    const t = new Texture({
      source: tileset.source,
      frame: new Rectangle(x, y, w, h),
    });
    nearest(t);
    return t;
  };

  // ================================================================
  // COASTLINE 3×3 AUTOTILE
  // ================================================================
  // Located at cols 1-3, rows 22-24 in the tileset.
  // These tiles show a grass island with rocky shoreline on a water bg.
  //
  //   (1,22)=NW  (2,22)=N   (3,22)=NE
  //   (1,23)=W   (2,23)=C   (3,23)=E
  //   (1,24)=SW  (2,24)=S   (3,24)=SE
  //
  const coast: Texture[] = [
    tile(1, 22), tile(2, 22), tile(3, 22), // NW, N, NE
    tile(1, 23), tile(2, 23), tile(3, 23), // W,  C, E
    tile(1, 24), tile(2, 24), tile(3, 24), // SW, S, SE
  ];

  // Inner corners: where water pokes into a corner of grass.
  // At cols 5/8, rows 21/24 in the tileset.
  const coastInner = [
    tile(5, 21),  // NW inner (water intrudes from NW)
    tile(8, 21),  // NE inner
    tile(5, 24),  // SW inner
    tile(8, 24),  // SE inner
  ];

  // Solid water fill tile
  const water = tile(0, 21);

  // ================================================================
  // INTERIOR GRASS VARIATIONS
  // ================================================================
  // Solid fill tiles only — NO edge/shore tiles! Picked from the
  // solid color areas of the tileset (grass autotile centers and
  // the large color fill blocks at cols 21-24 / rows 0-1).
  // Single grass tile for uniform look — variation comes from subtle
  // tinting in CityCanvas. Using only the coast-center tile ensures
  // no checkerboard effect from mixing different grass textures.
  const grass: Texture[] = [
    tile(2, 23),  // standard medium green (coast center)
  ];

  // ================================================================
  // DIRT/SAND PATH 3×3 AUTOTILE
  // ================================================================
  // Sand path on dark-green grass. Located at cols 15-17, rows 36-38.
  const path: Texture[] = [
    tile(15, 36), tile(16, 36), tile(17, 36),
    tile(15, 37), tile(16, 37), tile(17, 37),
    tile(15, 38), tile(16, 38), tile(17, 38),
  ];

  // ================================================================
  // TREES (from separate spritesheet files)
  // ================================================================
  const treeFiles = [
    { file: 'tree_basic_1-Sheet.png', h: 80 },
    { file: 'tree_basic_2-Sheet.png', h: 64 },
    { file: 'tree_basic_3-Sheet.png', h: 80 },
    { file: 'tree_basic_4-Sheet.png', h: 80 },
    { file: 'tree_pine-Sheet.png',    h: 64 },
  ];
  const trees: AnimatedSheet[] = [];
  for (const { file, h } of treeFiles) {
    const tex = await safeLoad(`${BASE}/trees/spring/${file}`);
    if (!tex) continue;
    nearest(tex);
    const fw = h; // frames are ~square
    const count = Math.floor(tex.frame.width / fw);
    if (count > 0) {
      trees.push({ frames: sliceFrames(tex, fw, h, count), frameW: fw, frameH: h });
    }
  }

  // ================================================================
  // CLOUDS (borrow from Tiny Swords if available)
  // ================================================================
  const clouds: Texture[] = [];
  for (let n = 1; n <= 8; n++) {
    const t = await safeLoad(`/assets/topdown/tinyswords-terrain/clouds/Clouds_0${n}.png`);
    if (t) { nearest(t); clouds.push(t); }
  }

  // ================================================================
  // BUILDINGS from tileset (multi-tile rectangles)
  // ================================================================
  const buildings = new Map<string, Texture>();

  // Houses (from bottom-right of tileset)
  buildings.set('farm:house_a', rect(49 * TILE, 24 * TILE, 7 * TILE, 7 * TILE));
  buildings.set('farm:house_b', rect(57 * TILE, 24 * TILE, 6 * TILE, 7 * TILE));
  buildings.set('farm:shop',    rect(63 * TILE, 23 * TILE, 8 * TILE, 9 * TILE));
  buildings.set('farm:barn',    rect(52 * TILE, 31 * TILE, 8 * TILE, 7 * TILE));
  buildings.set('farm:tower_a', rect(60 * TILE, 35 * TILE, 5 * TILE, 10 * TILE));
  buildings.set('farm:tower_b', rect(65 * TILE, 35 * TILE, 5 * TILE, 10 * TILE));
  buildings.set('farm:greenhouse', rect(63 * TILE, 3 * TILE, 12 * TILE, 17 * TILE));

  // Props
  buildings.set('farm:hay_bale',  rect(66 * TILE, 31 * TILE, 2 * TILE, 2 * TILE));
  buildings.set('farm:hay_stack', rect(69 * TILE, 33 * TILE, 3 * TILE, 2 * TILE));
  buildings.set('farm:crate',     rect(71 * TILE, 4 * TILE, 2 * TILE, 2 * TILE));

  for (const [, tex] of buildings) nearest(tex);

  cached = {
    tileset,
    water,
    coast,
    coastInner,
    grass,
    path,
    trees,
    clouds,
    buildings,
    tile,
    rect,
  };
  return cached;
}

export const FARM_TILE = TILE;
