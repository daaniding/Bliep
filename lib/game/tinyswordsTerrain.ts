import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown/tinyswords-terrain';

/**
 * Tiny Swords terrain loader (Pixel Frog free pack).
 *
 * Source sheet sizes:
 *  - Tilemap_color2.png : 576×384 dark-forest palette of the 9×6 autotile
 *  - water_bg.png       : 64×64 solid teal water
 *  - water_foam.png     : 3072×192 (16 frames × 192×192)
 *  - Tree1/2.png        : 1536×256 (8 frames × 192×256)
 *  - Tree3/4.png        : 1536×192 (8 frames × 192×192)
 *  - Stump1/2.png       : 192×256 single frame
 *  - Bush1..4.png       : 1024×128 (8 frames × 128×128)
 *  - Rock1..4.png       : 64×64 single frame
 *  - Clouds_01..08.png  : 576×256 single cloud image each
 *  - Sheep_Grass.png    : 1536×128 (12 frames × 128×128) grazing loop
 *  - Rubber duck.png    : 96×32 single
 *  - Water Rocks_N.png  : 1024×64 (16 frames × 64×64) animated
 *  - Gold Stone 1..6    : 128×128 single frame each
 *  - Wood Resource.png  : 64×64 single frame
 *
 * Pixi v8 TilingSprite ignores source frames so tile-sheet cells must be
 * baked into standalone textures via renderer.generateTexture at canvas
 * init time (see CityCanvas). This loader only hands out raw sprite
 * textures + animation frame arrays.
 */

const TILE = 64;

export interface AnimatedSheet {
  frames: Texture[];
  frameW: number;
  frameH: number;
}

export interface TinyswordsTerrain {
  tilemap: Texture;
  water: Texture;
  waterFoam: AnimatedSheet;
  trees: AnimatedSheet[];
  bushes: AnimatedSheet[];
  rocks: Texture[];
  stumps: Texture[];
  clouds: Texture[];
  sheepGrass: AnimatedSheet;
  sheepIdle: AnimatedSheet;
  sheepMove: AnimatedSheet;
  duck: Texture;
  waterRocks: AnimatedSheet[];
  goldStones: Texture[];
  wood: Texture;
  meat: Texture;
  tools: Texture[];
  shadow: Texture;
}

let cached: TinyswordsTerrain | null = null;

function sliceFrames(tex: Texture, frameW: number, frameH: number, count: number): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      new Texture({
        source: tex.source,
        frame: new Rectangle(i * frameW, 0, frameW, frameH),
      }),
    );
  }
  return out;
}

async function safeLoad(url: string): Promise<Texture | null> {
  try {
    return await Assets.load<Texture>(url);
  } catch (err) {
    console.warn('[tinyswordsTerrain] failed to load', url, err);
    return null;
  }
}

export async function loadTinyswordsTerrain(): Promise<TinyswordsTerrain> {
  if (cached) return cached;

  const tilemapTex = await Assets.load<Texture>(`${BASE}/tilemap2.png`);
  const waterTex = await Assets.load<Texture>(`${BASE}/water_bg.png`);
  const waterFoamTex = await Assets.load<Texture>(`${BASE}/water_foam.png`);

  const treeLoads = await Promise.all([
    Assets.load<Texture>(`${BASE}/trees/tree1.png`),
    Assets.load<Texture>(`${BASE}/trees/tree2.png`),
    Assets.load<Texture>(`${BASE}/trees/tree3.png`),
    Assets.load<Texture>(`${BASE}/trees/tree4.png`),
  ]);
  const stumpLoads = await Promise.all([
    Assets.load<Texture>(`${BASE}/trees/stump1.png`),
    Assets.load<Texture>(`${BASE}/trees/stump2.png`),
  ]);
  const bushLoads = await Promise.all([
    Assets.load<Texture>(`${BASE}/bushes/bush1.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush2.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush3.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush4.png`),
  ]);
  const rockLoads = await Promise.all([
    Assets.load<Texture>(`${BASE}/rocks/rock1.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock2.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock3.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock4.png`),
  ]);

  const cloudLoads = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => safeLoad(`${BASE}/clouds/Clouds_0${n}.png`)),
  );
  const clouds = cloudLoads.filter((t): t is Texture => !!t);

  const sheepGrassTex = await safeLoad(`${BASE}/sheep/sheep_grass.png`);
  const sheepIdleTex = await safeLoad(`${BASE}/sheep/sheep_idle.png`);
  const sheepMoveTex = await safeLoad(`${BASE}/sheep/sheep_move.png`);
  const duckTex = await safeLoad(`${BASE}/water/duck.png`);
  const meatTex = await safeLoad(`${BASE}/wood/meat.png`);
  const shadowTex = await safeLoad(`${BASE}/shadow.png`);
  const toolLoads = await Promise.all(
    [1, 2, 3, 4].map((n) => safeLoad(`${BASE}/wood/tool${n}.png`)),
  );
  const tools = toolLoads.filter((t): t is Texture => !!t);

  const waterRockLoads = await Promise.all([
    safeLoad(`${BASE}/water/water_rock1.png`),
    safeLoad(`${BASE}/water/water_rock2.png`),
    safeLoad(`${BASE}/water/water_rock3.png`),
    safeLoad(`${BASE}/water/water_rock4.png`),
  ]);

  const goldLoads = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) => safeLoad(`${BASE}/gold/stone${n}.png`)),
  );
  const gold = goldLoads.filter((t): t is Texture => !!t);

  const woodTex = await safeLoad(`${BASE}/wood/wood.png`);

  const setNearest = (t: Texture | null) => {
    if (t?.source) t.source.scaleMode = 'nearest';
  };
  for (const t of [tilemapTex, waterTex, waterFoamTex, sheepGrassTex, sheepIdleTex, sheepMoveTex, duckTex, woodTex, meatTex, shadowTex, ...treeLoads, ...stumpLoads, ...bushLoads, ...rockLoads, ...clouds, ...gold, ...tools]) setNearest(t);
  for (const t of waterRockLoads) setNearest(t);

  cached = {
    tilemap: tilemapTex,
    water: waterTex,
    waterFoam: { frames: sliceFrames(waterFoamTex, 192, 192, 16), frameW: 192, frameH: 192 },
    trees: [
      { frames: sliceFrames(treeLoads[0], 192, 256, 8), frameW: 192, frameH: 256 },
      { frames: sliceFrames(treeLoads[1], 192, 256, 8), frameW: 192, frameH: 256 },
      { frames: sliceFrames(treeLoads[2], 192, 192, 8), frameW: 192, frameH: 192 },
      { frames: sliceFrames(treeLoads[3], 192, 192, 8), frameW: 192, frameH: 192 },
    ],
    bushes: [
      { frames: sliceFrames(bushLoads[0], 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bushLoads[1], 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bushLoads[2], 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bushLoads[3], 128, 128, 8), frameW: 128, frameH: 128 },
    ],
    rocks: rockLoads,
    stumps: stumpLoads,
    clouds,
    sheepGrass: sheepGrassTex
      ? { frames: sliceFrames(sheepGrassTex, 128, 128, 12), frameW: 128, frameH: 128 }
      : { frames: [], frameW: 128, frameH: 128 },
    sheepIdle: sheepIdleTex
      ? { frames: sliceFrames(sheepIdleTex, 128, 128, 6), frameW: 128, frameH: 128 }
      : { frames: [], frameW: 128, frameH: 128 },
    sheepMove: sheepMoveTex
      ? { frames: sliceFrames(sheepMoveTex, 128, 128, 4), frameW: 128, frameH: 128 }
      : { frames: [], frameW: 128, frameH: 128 },
    duck: duckTex ?? Texture.EMPTY,
    waterRocks: waterRockLoads
      .filter((t): t is Texture => !!t)
      .map((t) => ({ frames: sliceFrames(t, 64, 64, 16), frameW: 64, frameH: 64 })),
    goldStones: gold,
    wood: woodTex ?? Texture.EMPTY,
    meat: meatTex ?? Texture.EMPTY,
    tools,
    shadow: shadowTex ?? Texture.EMPTY,
  };
  return cached;
}

/** Interior grass cells in Tilemap_color2 (shares layout with color1). */
export const GRASS_TILE_CELLS: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
];

export const CLIFF_TILE_CELLS: Array<[number, number]> = [
  [5, 5],
  [6, 5],
  [7, 5],
];

export const TILEMAP_CELL = TILE;
