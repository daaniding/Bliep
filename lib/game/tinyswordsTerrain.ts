import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown/tinyswords-terrain';

/**
 * Tiny Swords terrain (Pixel Frog, free pack).
 *
 * Source sheet sizes:
 *  - Tilemap_color1.png : 576×384 autotile, 9×6 cells of 64×64
 *  - water_bg.png       : 64×64 solid teal water
 *  - water_foam.png     : 3072×192 (16 frames × 192×192)
 *  - Tree1/2.png        : 1536×256 (8 frames × 192×256) — sway animation
 *  - Tree3/4.png        : 1536×192 (8 frames × 192×192)
 *  - Stump1/2.png       : 192×256 single frame
 *  - Bush1..4.png       : 1024×128 (8 frames × 128×128)
 *  - Rock1..4.png       : 64×64 single frame
 *
 * Pixi v8 TilingSprite ignores source frames (tiles the whole source) —
 * so grass/cliff cells from the tilemap must be baked into standalone
 * textures via renderer.generateTexture at canvas init time (see CityCanvas).
 * This loader only hands out raw sprite textures + animation frame arrays.
 */

const TILE = 64;

export interface AnimatedSheet {
  frames: Texture[];
  frameW: number;
  frameH: number;
}

export interface TinyswordsTerrain {
  /** Raw tilemap texture — CityCanvas slices + bakes this into grass/cliff. */
  tilemap: Texture;
  water: Texture;
  waterFoam: AnimatedSheet;
  trees: AnimatedSheet[];
  bushes: AnimatedSheet[];
  rocks: Texture[];
  stumps: Texture[];
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

export async function loadTinyswordsTerrain(): Promise<TinyswordsTerrain> {
  if (cached) return cached;

  const [
    tilemapTex,
    waterTex,
    waterFoamTex,
    tree1, tree2, tree3, tree4,
    stump1, stump2,
    bush1, bush2, bush3, bush4,
    rock1, rock2, rock3, rock4,
  ] = await Promise.all([
    Assets.load<Texture>(`${BASE}/tilemap.png`),
    Assets.load<Texture>(`${BASE}/water_bg.png`),
    Assets.load<Texture>(`${BASE}/water_foam.png`),
    Assets.load<Texture>(`${BASE}/trees/tree1.png`),
    Assets.load<Texture>(`${BASE}/trees/tree2.png`),
    Assets.load<Texture>(`${BASE}/trees/tree3.png`),
    Assets.load<Texture>(`${BASE}/trees/tree4.png`),
    Assets.load<Texture>(`${BASE}/trees/stump1.png`),
    Assets.load<Texture>(`${BASE}/trees/stump2.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush1.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush2.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush3.png`),
    Assets.load<Texture>(`${BASE}/bushes/bush4.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock1.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock2.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock3.png`),
    Assets.load<Texture>(`${BASE}/rocks/rock4.png`),
  ]);

  const setNearest = (t: Texture) => { if (t.source) t.source.scaleMode = 'nearest'; };
  for (const t of [tilemapTex, waterTex, waterFoamTex, tree1, tree2, tree3, tree4, stump1, stump2, bush1, bush2, bush3, bush4, rock1, rock2, rock3, rock4]) setNearest(t);

  cached = {
    tilemap: tilemapTex,
    water: waterTex,
    waterFoam: { frames: sliceFrames(waterFoamTex, 192, 192, 16), frameW: 192, frameH: 192 },
    trees: [
      { frames: sliceFrames(tree1, 192, 256, 8), frameW: 192, frameH: 256 },
      { frames: sliceFrames(tree2, 192, 256, 8), frameW: 192, frameH: 256 },
      { frames: sliceFrames(tree3, 192, 192, 8), frameW: 192, frameH: 192 },
      { frames: sliceFrames(tree4, 192, 192, 8), frameW: 192, frameH: 192 },
    ],
    bushes: [
      { frames: sliceFrames(bush1, 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bush2, 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bush3, 128, 128, 8), frameW: 128, frameH: 128 },
      { frames: sliceFrames(bush4, 128, 128, 8), frameW: 128, frameH: 128 },
    ],
    rocks: [rock1, rock2, rock3, rock4],
    stumps: [stump1, stump2],
  };
  return cached;
}

/** Tilemap_color1 cell coordinates known to contain an interior grass fill. */
export const GRASS_TILE_CELLS: Array<[number, number]> = [
  [1, 1],
  [1, 2],
  [6, 1],
  [7, 1],
];

/** Tilemap_color1 cell coordinates with a clean stone-cliff front facing. */
export const CLIFF_TILE_CELLS: Array<[number, number]> = [
  [5, 5],
  [6, 5],
  [7, 5],
];

export const TILEMAP_CELL = TILE;
