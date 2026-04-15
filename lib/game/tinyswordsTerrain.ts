import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown/tinyswords-terrain';

/**
 * Tiny Swords terrain (Pixel Frog, free pack).
 *
 * Tilemap_color1.png is a 576×384 autotile sheet of 64×64 cells (9 cols × 6
 * rows). For Bliep we don't need full autotiling yet — we grab a clean
 * grass-interior tile and a front-cliff tile and tile them across the map.
 *
 * Trees + bushes are animation sheets — we take frame 0 for a static render.
 *  - Tree1/2: 1536×256 = 8 frames × 192×256
 *  - Tree3/4: 1536×192 = 8 frames × 192×192
 *  - Bushes : 1024×128 = 8 frames × 128×128
 *  - Stumps : 192×256 single frame
 *  - Rocks  : 64×64 single frame
 */

const TILE = 64;

export interface TinyswordsTerrain {
  grass: Texture;
  cliff: Texture;
  water: Texture;
  trees: Texture[];
  bushes: Texture[];
  rocks: Texture[];
  stumps: Texture[];
}

let cached: TinyswordsTerrain | null = null;

function firstFrame(tex: Texture, frameW: number, frameH: number): Texture {
  return new Texture({
    source: tex.source,
    frame: new Rectangle(0, 0, frameW, frameH),
  });
}

export async function loadTinyswordsTerrain(): Promise<TinyswordsTerrain> {
  if (cached) return cached;

  const [
    tilemapTex,
    waterTex,
    tree1, tree2, tree3, tree4,
    stump1, stump2,
    bush1, bush2, bush3, bush4,
    rock1, rock2, rock3, rock4,
  ] = await Promise.all([
    Assets.load<Texture>(`${BASE}/tilemap.png`),
    Assets.load<Texture>(`${BASE}/water_bg.png`),
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

  // Pixel-art sources need nearest-neighbor scaling so the autotile stays
  // crisp at non-1× zoom levels.
  const setNearest = (t: Texture) => { if (t.source) t.source.scaleMode = 'nearest'; };
  setNearest(tilemapTex);
  setNearest(waterTex);
  for (const t of [tree1, tree2, tree3, tree4, stump1, stump2, bush1, bush2, bush3, bush4, rock1, rock2, rock3, rock4]) setNearest(t);

  const sub = (col: number, row: number): Texture =>
    new Texture({
      source: tilemapTex.source,
      frame: new Rectangle(col * TILE, row * TILE, TILE, TILE),
    });

  cached = {
    grass: sub(1, 1),
    cliff: sub(5, 5),
    water: waterTex,
    trees: [
      firstFrame(tree1, 192, 256),
      firstFrame(tree2, 192, 256),
      firstFrame(tree3, 192, 192),
      firstFrame(tree4, 192, 192),
    ],
    bushes: [
      firstFrame(bush1, 128, 128),
      firstFrame(bush2, 128, 128),
      firstFrame(bush3, 128, 128),
      firstFrame(bush4, 128, 128),
    ],
    rocks: [rock1, rock2, rock3, rock4],
    stumps: [stump1, stump2],
  };
  return cached;
}
