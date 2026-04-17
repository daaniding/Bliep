/**
 * Antarcticbees "Farm 4 Seasons" terrain loader.
 *
 * Source: farm_spring_summer.png (1200×720 = 75×45 tiles at 16px).
 * Also loads standalone tree sprite sheets and NPC sprites.
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
  tileset: Texture;
  water: Texture;
  /** 4 animation frames of the base water tile (rows 21,26,31,36 col 0). */
  waterFrames: Texture[];
  /** Animated rocks sitting in water (4 variants, 16 frames each). */
  waterRocks: AnimatedSheet[];
  /** Foam/splash animation (16 frames of 192×192). */
  waterFoam: AnimatedSheet | null;
  /** Fish sprites. */
  fishes: Texture[];
  /** Animated duck (3 frames). */
  duck: AnimatedSheet | null;

  /** 3×3 coastline (sand→water): [NW,N,NE, W,C,E, SW,S,SE] */
  coast: Texture[];
  /** Inner corners: [NW,NE,SW,SE] */
  coastInner: Texture[];

  /** Single grass fill tile. */
  grass: Texture[];
  /** Sand fill tile. */
  sandFill: Texture;
  /** 3×3 sand-on-grass transition (path autotile). */
  sandToGrass: Texture[];

  // ---- Decorations ----
  flowersWhite: Texture[];
  flowersPurple: Texture[];
  grassTufts: Texture[];
  mushrooms: Texture[];
  /** Coastal rocks and boulders. */
  rocks: Texture[];
  /** Cattails/reeds for water edges. */
  cattails: Texture[];
  /** Stone/cobblestone path center fill tiles. */
  stonePath: Texture[];

  // ---- Trees ----
  trees: AnimatedSheet[];
  largeTrees: Texture[];
  cherryTrees: Texture[];
  fruitTrees: Texture[];
  bushes: Texture[];

  // ---- Animated assets ----
  /** Windmill animation (4 frames, 96×128). */
  windmill: AnimatedSheet | null;

  /** Cloud sprites. */
  clouds: Texture[];
  /**
   * Animated water edge tiles (4 frames each).
   * The tileset has 4 animation frames at 5-row intervals (base rows 21, 26, 31, 36).
   * Water tiles adjacent to coast have shifting foam/wave patterns.
   *
   * Keyed by direction: which side of the water cell has land.
   * E.g. 'S' = water cell with land to the south → foam on south edge.
   */
  waterEdge: {
    N: Texture[];   // foam on north edge (land above)
    S: Texture[];   // foam on south edge (land below)
    W: Texture[];   // foam on west edge (land left)
    E: Texture[];   // foam on east edge (land right)
    NW: Texture[];  // corner: land to NW
    NE: Texture[];  // corner: land to NE
    SW: Texture[];  // corner: land to SW
    SE: Texture[];  // corner: land to SE
  };

  /** Building sprites keyed by slug. */
  buildings: Map<string, Texture>;

  tile: (col: number, row: number) => Texture;
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

  // ============================================================
  // COASTLINE 3×3 (cols 1-3, rows 22-24)
  // ============================================================
  const coast: Texture[] = [
    tile(1, 22), tile(2, 22), tile(3, 22),
    tile(1, 23), tile(2, 23), tile(3, 23),
    tile(1, 24), tile(2, 24), tile(3, 24),
  ];
  const coastInner = [
    tile(5, 21), tile(8, 21),
    tile(5, 24), tile(8, 24),
  ];
  const water = tile(0, 21);

  // ============================================================
  // GRASS — textured tiles, all similar medium-green base
  // Tint variation provides colour patches; tiles provide texture.
  // ============================================================
  const grass: Texture[] = [
    tile(19, 1),  // medium green, clean
    tile(20, 1),  // medium green, grass blade details
    tile(21, 1),  // medium green, sprout details
    tile(20, 0),  // slightly lighter, subtle dots (for variety)
  ];

  // ============================================================
  // FLOWERS — white daisies at cols 21-23, rows 4-5
  // ============================================================
  const flowersWhite = [
    tile(21, 4), tile(22, 4), tile(23, 4),
    tile(21, 5), tile(22, 5), tile(23, 5),
    tile(23, 3), // extra white flower variant
  ];

  // Purple/iris flowers at cols 24-25, rows 4-5
  const flowersPurple = [
    tile(24, 4), tile(25, 4),
    tile(24, 5), tile(25, 5),
  ];

  // ============================================================
  // GRASS TUFTS — small weeds/sprouts at cols 21-25, rows 2-3
  // ============================================================
  const grassTufts = [
    tile(21, 2), tile(22, 2), tile(23, 2), tile(24, 2), tile(25, 2),
    tile(21, 3), tile(22, 3), tile(23, 3),
    tile(25, 5), // tall grass tuft
    tile(26, 4), // small grass
  ];

  // ============================================================
  // SAND (beach band between grass and water)
  // ============================================================
  const sandFill = tile(16, 37); // center of path autotile = solid sand
  // 3×3 sand-on-grass autotile (path tiles)
  const sandToGrass: Texture[] = [
    tile(15, 36), tile(16, 36), tile(17, 36),
    tile(15, 37), tile(16, 37), tile(17, 37),
    tile(15, 38), tile(16, 38), tile(17, 38),
  ];

  // ============================================================
  // ROCKS (coastal boulders and field stones)
  // ============================================================
  const rocks = [
    rect(17 * TILE, 5 * TILE, TILE, TILE),     // small log
    rect(18 * TILE, 6 * TILE, 2 * TILE, TILE), // rock pile
    tile(18, 7),                                 // single stone
  ];
  for (const t of rocks) nearest(t);

  // ============================================================
  // MUSHROOMS at cols 13-17, row 5
  // ============================================================
  const mushrooms = [
    tile(13, 5), // red toadstool
    tile(14, 5), // yellow mushroom
    tile(15, 5), // brown mushroom
    tile(16, 5), // fallen mushrooms
    tile(17, 5), // dark mushroom
  ];

  // ============================================================
  // STONE PATHS — cobblestone center fill tiles
  // ============================================================
  const stonePath = [
    tile(18, 9),   // cobblestone fill variant 1
    tile(18, 13),  // cobblestone fill variant 2
    tile(18, 17),  // cobblestone fill variant 3
  ];
  for (const t of stonePath) nearest(t);

  // ============================================================
  // TREES — from separate spritesheet files
  // ============================================================
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
    const fw = h;
    const count = Math.floor(tex.frame.width / fw);
    if (count > 0) {
      trees.push({ frames: sliceFrames(tex, fw, h, count), frameW: fw, frameH: h });
    }
  }

  // ============================================================
  // LARGE TREES from tileset (multi-tile standalone)
  // These are at rows 37-44 in the tileset — progression of sizes
  // ============================================================
  const largeTrees = [
    // Medium tree ~32×48 at around (27,37)
    rect(27 * TILE, 37 * TILE, 2 * TILE, 3 * TILE),
    // Large tree ~48×48 at around (29,37)
    rect(29 * TILE, 37 * TILE, 3 * TILE, 3 * TILE),
    // Very large tree ~48×64 at around (32,37)
    rect(32 * TILE, 36 * TILE, 4 * TILE, 4 * TILE),
    // Second row medium
    rect(27 * TILE, 41 * TILE, 2 * TILE, 3 * TILE),
    // Second row large
    rect(29 * TILE, 41 * TILE, 3 * TILE, 3 * TILE),
    // Second row very large
    rect(32 * TILE, 40 * TILE, 4 * TILE, 4 * TILE),
  ];
  for (const t of largeTrees) nearest(t);

  // Cherry blossom trees (pink!) at ~cols 37-39
  const cherryTrees = [
    rect(36 * TILE, 36 * TILE, 4 * TILE, 4 * TILE), // large cherry
    rect(36 * TILE, 40 * TILE, 4 * TILE, 5 * TILE), // larger cherry
  ];
  for (const t of cherryTrees) nearest(t);

  // Fruit trees from the right side of tileset
  const fruitTrees = [
    rect(40 * TILE, 24 * TILE, 4 * TILE, 5 * TILE), // cherry fruit tree
    rect(40 * TILE, 30 * TILE, 4 * TILE, 5 * TILE), // orange fruit tree
    rect(40 * TILE, 36 * TILE, 4 * TILE, 5 * TILE), // apple fruit tree
    rect(40 * TILE, 41 * TILE, 4 * TILE, 4 * TILE), // heart fruit tree
  ];
  for (const t of fruitTrees) nearest(t);

  // Small bushes (from tileset small tree at ~24,37)
  const bushes = [
    rect(24 * TILE, 38 * TILE, TILE, TILE),       // tiny bush
    rect(25 * TILE, 37 * TILE, 2 * TILE, 2 * TILE), // small bush
    rect(24 * TILE, 42 * TILE, TILE, TILE),       // tiny bush variant
    rect(25 * TILE, 41 * TILE, 2 * TILE, 2 * TILE), // small bush variant
    rect(24 * TILE, 37 * TILE, TILE, TILE),       // round bush
    rect(25 * TILE, 41 * TILE, TILE, TILE),       // small variant
  ];
  for (const t of bushes) nearest(t);

  // Cattails / reeds for water edges
  const cattails = [
    tile(19, 5),  // tall reed/cattail
    tile(20, 5),  // reed variant
    tile(19, 4),  // shorter reed
    tile(20, 4),  // short reed variant
  ];
  for (const t of cattails) nearest(t);

  // ============================================================
  // WINDMILL (animated building, 4 frames)
  // ============================================================
  let windmill: AnimatedSheet | null = null;
  const windmillTex = await safeLoad(`${BASE}/windmill/windmill_spring_summerSheet.png`);
  if (windmillTex) {
    nearest(windmillTex);
    // 384×128 = 4 frames of 96×128
    windmill = { frames: sliceFrames(windmillTex, 96, 128, 4), frameW: 96, frameH: 128 };
  }

  // ============================================================
  // ANIMATED WATER EDGES (4 frames at 5-row intervals)
  // The pond preview block at cols 0-3 shows water edges around a
  // 2×2 coast island. The water tiles animate; the coast stays static.
  // Base rows: 21, 26, 31, 36 → 4 animation frames.
  // ============================================================
  const baseRows = [21, 26, 31, 36];
  const waterEdge = {
    // Which side of the water cell has the foam/land
    N:  baseRows.map(b => tile(1, b)),     // top foam (land above, from top row of pond)
    S:  baseRows.map(b => tile(1, b + 3)), // bottom foam (land below)
    W:  baseRows.map(b => tile(0, b + 1)), // left foam (land to the left)
    E:  baseRows.map(b => tile(3, b + 1)), // right foam (land to the right)
    NW: baseRows.map(b => tile(0, b)),     // top-left corner
    NE: baseRows.map(b => tile(3, b)),     // top-right corner
    SW: baseRows.map(b => tile(0, b + 3)), // bottom-left corner
    SE: baseRows.map(b => tile(3, b + 3)), // bottom-right corner
  };
  for (const frames of Object.values(waterEdge)) {
    for (const t of frames) nearest(t);
  }

  // ============================================================
  // ANIMATED WATER FILL (4 frames — same base rows as waterEdge)
  // The water fill tile at col 2, row base+1 is the center water.
  // ============================================================
  const waterFrames = baseRows.map(b => {
    // The water fill tile is at col 0, base row (same position as main water)
    // Each frame block has a slightly different version for animation
    const t = tile(0, b);
    nearest(t);
    return t;
  });

  // ============================================================
  // WATER ROCKS (4 variants × 16 frames of 64×64)
  // ============================================================
  const waterRocks: AnimatedSheet[] = [];
  for (let i = 1; i <= 4; i++) {
    const tex = await safeLoad(`/assets/topdown/tinyswords-terrain/water/water_rock${i}.png`);
    if (tex) {
      nearest(tex);
      const fw = 64, fh = 64;
      const count = Math.floor(tex.frame.width / fw);
      if (count > 0) waterRocks.push({ frames: sliceFrames(tex, fw, fh, count), frameW: fw, frameH: fh });
    }
  }

  // ============================================================
  // WATER FOAM (16 frames of 192×192)
  // ============================================================
  let waterFoam: AnimatedSheet | null = null;
  const foamTex = await safeLoad('/assets/topdown/tinyswords-terrain/water_foam.png');
  if (foamTex) {
    nearest(foamTex);
    const fw = 192, fh = 192;
    const count = Math.floor(foamTex.frame.width / fw);
    if (count > 0) waterFoam = { frames: sliceFrames(foamTex, fw, fh, count), frameW: fw, frameH: fh };
  }

  // ============================================================
  // FISHES (from fishes.png — 64×32, 4 columns × 2 rows of 16×16)
  // ============================================================
  const fishTex = await safeLoad(`${BASE}/fishes.png`);
  const fishes: Texture[] = [];
  if (fishTex) {
    nearest(fishTex);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        fishes.push(new Texture({ source: fishTex.source, frame: new Rectangle(c * 16, r * 16, 16, 16) }));
      }
    }
  }

  // ============================================================
  // DUCK (3 frames of 32×32)
  // ============================================================
  let duck: AnimatedSheet | null = null;
  const duckTex = await safeLoad('/assets/topdown/tinyswords-terrain/water/duck.png');
  if (duckTex) {
    nearest(duckTex);
    duck = { frames: sliceFrames(duckTex, 32, 32, 3), frameW: 32, frameH: 32 };
  }

  // ============================================================
  // CLOUDS
  // ============================================================
  const clouds: Texture[] = [];
  for (let n = 1; n <= 8; n++) {
    const t = await safeLoad(`/assets/topdown/tinyswords-terrain/clouds/Clouds_0${n}.png`);
    if (t) { nearest(t); clouds.push(t); }
  }

  // ============================================================
  // BUILDINGS
  // ============================================================
  const buildings = new Map<string, Texture>();
  buildings.set('farm:house_a', rect(49 * TILE, 24 * TILE, 7 * TILE, 7 * TILE));
  buildings.set('farm:house_b', rect(57 * TILE, 24 * TILE, 6 * TILE, 7 * TILE));
  buildings.set('farm:shop',    rect(63 * TILE, 23 * TILE, 8 * TILE, 9 * TILE));
  buildings.set('farm:barn',    rect(52 * TILE, 31 * TILE, 8 * TILE, 7 * TILE));
  buildings.set('farm:tower_a', rect(60 * TILE, 35 * TILE, 5 * TILE, 10 * TILE));
  buildings.set('farm:tower_b', rect(65 * TILE, 35 * TILE, 5 * TILE, 10 * TILE));
  buildings.set('farm:greenhouse', rect(63 * TILE, 3 * TILE, 12 * TILE, 17 * TILE));
  buildings.set('farm:hay_bale',  rect(66 * TILE, 31 * TILE, 2 * TILE, 2 * TILE));
  buildings.set('farm:hay_stack', rect(69 * TILE, 33 * TILE, 3 * TILE, 2 * TILE));
  buildings.set('farm:crate',     rect(71 * TILE, 4 * TILE, 2 * TILE, 2 * TILE));
  for (const [, tex] of buildings) nearest(tex);

  cached = {
    tileset, water, waterFrames, waterRocks, waterFoam, fishes, duck,
    coast, coastInner, grass,
    sandFill, sandToGrass, rocks, cattails, stonePath,
    flowersWhite, flowersPurple, grassTufts, mushrooms,
    trees, largeTrees, cherryTrees, fruitTrees, bushes,
    windmill, waterEdge,
    clouds, buildings, tile, rect,
  };
  return cached;
}

export const FARM_TILE = TILE;
