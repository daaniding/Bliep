import { Assets, Rectangle, Texture } from 'pixi.js';

const KENNEY_BASE = '/assets/kenney';
const TRPG_BASE = '/assets/trpg';

// ---------- Kenney sprite slugs ----------

export const BUILDING_SLUGS = Array.from({ length: 23 }, (_, i) =>
  `medievalStructure_${(i + 1).toString().padStart(2, '0')}`,
);
export const UNIT_SLUGS = Array.from({ length: 24 }, (_, i) =>
  `medievalUnit_${(i + 1).toString().padStart(2, '0')}`,
);
export const ENV_SLUGS = Array.from({ length: 21 }, (_, i) =>
  `medievalEnvironment_${(i + 1).toString().padStart(2, '0')}`,
);

const slugToUrl = (slug: string) => {
  if (slug.startsWith('medievalStructure')) return `${KENNEY_BASE}/buildings/${slug}.png`;
  if (slug.startsWith('medievalUnit')) return `${KENNEY_BASE}/units/${slug}.png`;
  if (slug.startsWith('medievalEnvironment')) return `${KENNEY_BASE}/environment/${slug}.png`;
  return slug;
};

// ---------- gvituri TRPG tilesheet (16x16 cells) ----------

interface TileFrame { x: number; y: number; w: number; h: number }

/**
 * Hand-mapped frames from /assets/trpg/tiles.png (176x170, 11x10 cells of 16px).
 * Slugs prefixed with `trpg:` so the loader knows to slice from the sheet.
 */
export const TRPG_TILE_FRAMES: Record<string, TileFrame> = {
  // Elevated terrain blocks (top + dirt skirt)
  'trpg:grass_block':   { x: 0,   y: 0,  w: 16, h: 32 },
  'trpg:moss_block':    { x: 16,  y: 0,  w: 16, h: 32 },
  'trpg:stone_block':   { x: 32,  y: 0,  w: 16, h: 32 },
  'trpg:sand_block':    { x: 48,  y: 0,  w: 16, h: 32 },
  'trpg:snow_block':    { x: 0,   y: 32, w: 16, h: 32 },
  'trpg:ice_block':     { x: 16,  y: 32, w: 16, h: 32 },
  'trpg:lava_block':    { x: 32,  y: 32, w: 16, h: 32 },
  'trpg:clay_block':    { x: 48,  y: 32, w: 16, h: 32 },

  // Decor (right column, rows 0-3)
  'trpg:rock_small':    { x: 128, y: 0,  w: 16, h: 16 },
  'trpg:rock_big':      { x: 144, y: 0,  w: 16, h: 16 },
  'trpg:cactus':        { x: 160, y: 0,  w: 16, h: 16 },
  'trpg:bush':          { x: 128, y: 16, w: 16, h: 16 },
  'trpg:flowers':       { x: 144, y: 16, w: 16, h: 16 },
  'trpg:coral':         { x: 160, y: 16, w: 16, h: 16 },
  'trpg:log':           { x: 128, y: 32, w: 16, h: 16 },
  'trpg:plant_small':   { x: 144, y: 32, w: 16, h: 16 },
  'trpg:crystal_blue':  { x: 160, y: 32, w: 16, h: 16 },
  'trpg:wood_post':     { x: 128, y: 48, w: 16, h: 16 },
  'trpg:plant_tall':    { x: 144, y: 48, w: 16, h: 16 },
  'trpg:pine_tree':     { x: 160, y: 48, w: 16, h: 16 },

  // Flat ground tiles (rows 4+, picked variants)
  'trpg:ground_grass_a':  { x: 0,   y: 64,  w: 16, h: 16 },
  'trpg:ground_grass_b':  { x: 32,  y: 64,  w: 16, h: 16 },
  'trpg:ground_grass_c':  { x: 64,  y: 64,  w: 16, h: 16 },
  'trpg:ground_grass_d':  { x: 96,  y: 80,  w: 16, h: 16 },
  'trpg:ground_clay_a':   { x: 0,   y: 96,  w: 16, h: 16 },
  'trpg:ground_clay_b':   { x: 48,  y: 112, w: 16, h: 16 },
  'trpg:ground_sand_a':   { x: 0,   y: 128, w: 16, h: 16 },
  'trpg:ground_sand_b':   { x: 48,  y: 128, w: 16, h: 16 },
  'trpg:ground_stone_a':  { x: 0,   y: 144, w: 16, h: 16 },
  'trpg:ground_path':     { x: 80,  y: 144, w: 16, h: 16 },
};

/**
 * Bliep uses the elevated 16x32 blocks as its ground tiles — they have a
 * 16x8 diamond top face plus a 16x24 dirt skirt that visually wraps the tile
 * with 3D depth. Anchor (0.5, 0.25) keeps the diamond top centered on the
 * grid cell while the skirt overlaps the row in front.
 */
export const TRPG_GROUND_GRASS_SLUGS = [
  'trpg:grass_block',
  'trpg:moss_block',
];

export const TRPG_GROUND_DARK_SLUGS = [
  'trpg:moss_block',
  'trpg:clay_block',
];

export const TRPG_DECOR_TREES = ['trpg:pine_tree', 'trpg:plant_tall', 'trpg:plant_small'];
export const TRPG_DECOR_BUSHES = ['trpg:bush', 'trpg:flowers', 'trpg:cactus'];
export const TRPG_DECOR_ROCKS = ['trpg:rock_small', 'trpg:rock_big', 'trpg:log', 'trpg:wood_post'];
export const TRPG_DECOR_MOUNTAINS = ['trpg:stone_block', 'trpg:snow_block', 'trpg:ice_block'];

// ---------- Loader ----------

let atlasPromise: Promise<Map<string, Texture>> | null = null;

async function loadTrpgFrames(): Promise<Map<string, Texture>> {
  const out = new Map<string, Texture>();
  Assets.add({ alias: 'trpg-tiles', src: `${TRPG_BASE}/tiles.png` });
  const sheet = await Assets.load<Texture>('trpg-tiles');
  // Pixel-perfect: nearest neighbour scaling
  if (sheet?.source) {
    sheet.source.scaleMode = 'nearest';
  }
  for (const [slug, f] of Object.entries(TRPG_TILE_FRAMES)) {
    const t = new Texture({
      source: sheet.source,
      frame: new Rectangle(f.x, f.y, f.w, f.h),
    });
    out.set(slug, t);
  }
  return out;
}

export function loadAtlas(): Promise<Map<string, Texture>> {
  if (atlasPromise) return atlasPromise;
  const kenneySlugs = [...BUILDING_SLUGS, ...UNIT_SLUGS, ...ENV_SLUGS];
  atlasPromise = (async () => {
    const map = new Map<string, Texture>();

    // Kenney individual files (parallel)
    const entries = kenneySlugs.map(s => ({ alias: s, src: slugToUrl(s) }));
    Assets.add(entries);
    const textures = await Assets.load<Texture>(entries.map(e => e.alias));
    if (textures instanceof Map) {
      for (const [k, v] of textures) map.set(k as string, v as Texture);
    } else if (typeof textures === 'object' && textures) {
      for (const [k, v] of Object.entries(textures as Record<string, Texture>)) {
        map.set(k, v);
      }
    }
    for (const s of kenneySlugs) {
      if (!map.has(s)) {
        try {
          const t = await Assets.load<Texture>(slugToUrl(s));
          map.set(s, t);
        } catch { /* ignore */ }
      }
    }

    // Make Kenney sprites pixel-perfect too
    for (const t of map.values()) {
      if (t?.source) {
        t.source.scaleMode = 'nearest';
      }
    }

    // TRPG sliced frames
    try {
      const trpg = await loadTrpgFrames();
      for (const [k, v] of trpg) map.set(k, v);
    } catch { /* if missing, fall back to Kenney decor */ }

    return map;
  })();
  return atlasPromise;
}

export function getTexture(map: Map<string, Texture>, slug: string): Texture {
  return map.get(slug) ?? Texture.EMPTY;
}
