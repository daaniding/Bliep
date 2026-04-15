import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown/tinyswords-terrain';

/**
 * Tiny Swords terrain (Pixel Frog, free pack).
 *
 * Tilemap_color1.png is a 576×384 autotile sheet of 64×64 cells (9 cols × 6
 * rows). For Bliep we don't need full autotiling yet — we just grab a clean
 * grass-interior tile and a front-cliff tile, and tile them across the map
 * with TilingSprite. Water is a separate 64×64 repeating texture.
 *
 * Tile coordinates are picked by eye from the sheet:
 *  - grass interior: col 1, row 1 (solid center of the top-left grass block)
 *  - cliff front:    col 5, row 5 (stone wall strip)
 */

const TILE = 64;

export interface TinyswordsTerrain {
  grass: Texture;
  cliff: Texture;
  water: Texture;
}

let cached: TinyswordsTerrain | null = null;

export async function loadTinyswordsTerrain(): Promise<TinyswordsTerrain> {
  if (cached) return cached;

  const [tilemapTex, waterTex] = await Promise.all([
    Assets.load<Texture>(`${BASE}/tilemap.png`),
    Assets.load<Texture>(`${BASE}/water_bg.png`),
  ]);

  const sub = (col: number, row: number): Texture =>
    new Texture({
      source: tilemapTex.source,
      frame: new Rectangle(col * TILE, row * TILE, TILE, TILE),
    });

  cached = {
    grass: sub(1, 1),
    cliff: sub(5, 5),
    water: waterTex,
  };
  return cached;
}
