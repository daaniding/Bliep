import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown';

// ---------- Standalone PNG sprites (free-form sized) ----------

/** Standalone building sprites. Key = slug, value = url. */
export const BUILDING_FILES: Record<string, string> = {
  house_hay_1: `${BASE}/buildings/house_hay_1.png`,
  house_hay_2: `${BASE}/buildings/house_hay_2.png`,
  house_hay_3: `${BASE}/buildings/house_hay_3.png`,
  house_hay_4: `${BASE}/buildings/house_hay_4.png`,
  well: `${BASE}/buildings/well.png`,
  wall_gate: `${BASE}/buildings/wall_gate.png`,
};

export const DECOR_FILES: Record<string, string> = {
  oak_tree: `${BASE}/decor/oak_tree.png`,
  oak_tree_small: `${BASE}/decor/oak_tree_small.png`,
  tree_emerald_1: `${BASE}/decor/tree_emerald_1.png`,
  tree_emerald_2: `${BASE}/decor/tree_emerald_2.png`,
  tree_emerald_3: `${BASE}/decor/tree_emerald_3.png`,
  tree_emerald_4: `${BASE}/decor/tree_emerald_4.png`,
  bush_emerald_1: `${BASE}/decor/bush_emerald_1.png`,
  bush_emerald_2: `${BASE}/decor/bush_emerald_2.png`,
  bush_emerald_3: `${BASE}/decor/bush_emerald_3.png`,
  bush_emerald_4: `${BASE}/decor/bush_emerald_4.png`,
  bush_emerald_5: `${BASE}/decor/bush_emerald_5.png`,
  rock_brown_1: `${BASE}/decor/Rock_Brown_1.png`,
  rock_brown_2: `${BASE}/decor/Rock_Brown_2.png`,
  rock_brown_4: `${BASE}/decor/Rock_Brown_4.png`,
  rock_brown_6: `${BASE}/decor/Rock_Brown_6.png`,
  rock_brown_9: `${BASE}/decor/Rock_Brown_9.png`,
  chest: `${BASE}/decor/chest.png`,
  flowers_red: `${BASE}/decor/flowers_red.png`,
  flowers_white: `${BASE}/decor/flowers_white.png`,
  campfire: `${BASE}/decor/campfire.png`,
};

export const PROP_FILES: Record<string, string> = {
  banner: `${BASE}/props/banner_stick_1_purple.png`,
  barrel: `${BASE}/props/barrel_small_empty.png`,
  basket: `${BASE}/props/basket_empty.png`,
  bench_1: `${BASE}/props/bench_1.png`,
  bench_3: `${BASE}/props/bench_3.png`,
  bulletin: `${BASE}/props/bulletinboard_1.png`,
  crate: `${BASE}/props/crate_large_empty.png`,
  fireplace: `${BASE}/props/fireplace_1.png`,
  haystack: `${BASE}/props/haystack_2.png`,
  lamppost: `${BASE}/props/lamppost_3.png`,
  plant: `${BASE}/props/plant_2.png`,
  sack: `${BASE}/props/sack_3.png`,
  sign_1: `${BASE}/props/sign_1.png`,
  sign_2: `${BASE}/props/sign_2.png`,
};

// ---------- Sliced sprites from tilesheets ----------

interface TileFrame { x: number; y: number; w: number; h: number }

/**
 * Fan-tasy ground tileset (192x224, 12x14 cells of 16px). Plain grass fill
 * tiles are at rows 6-7 cols 0-3 (8 variants).
 */
export const GROUND_FRAMES: Record<string, TileFrame> = {
  grass_a: { x: 0,  y: 96, w: 16, h: 16 },
  grass_b: { x: 16, y: 96, w: 16, h: 16 },
  grass_c: { x: 32, y: 96, w: 16, h: 16 },
  grass_d: { x: 48, y: 96, w: 16, h: 16 },
  grass_e: { x: 0,  y: 112, w: 16, h: 16 },
  grass_f: { x: 16, y: 112, w: 16, h: 16 },
  grass_g: { x: 32, y: 112, w: 16, h: 16 },
  grass_h: { x: 48, y: 112, w: 16, h: 16 },
  // Grass-on-dirt edge autotile (right half of sheet, rows 0-5)
  edge_top_left:    { x: 96,  y: 0,  w: 16, h: 16 },
  edge_top:         { x: 112, y: 0,  w: 16, h: 16 },
  edge_top_right:   { x: 128, y: 0,  w: 16, h: 16 },
  edge_left:        { x: 96,  y: 16, w: 16, h: 16 },
  edge_center:      { x: 112, y: 16, w: 16, h: 16 },
  edge_right:       { x: 128, y: 16, w: 16, h: 16 },
  edge_bot_left:    { x: 96,  y: 32, w: 16, h: 16 },
  edge_bot:         { x: 112, y: 32, w: 16, h: 16 },
  edge_bot_right:   { x: 128, y: 32, w: 16, h: 16 },
};

export const GROUND_GRASS_SLUGS = [
  'grass_a', 'grass_b', 'grass_c', 'grass_d',
  'grass_e', 'grass_f', 'grass_g', 'grass_h',
];

/**
 * Big houses pack (1024x1024). Pulls 3 large buildings (purple/grey/red)
 * with rough manual frames.
 */
export const BIG_HOUSE_FRAMES: Record<string, TileFrame> = {
  big_house_purple: { x: 0,   y: 0,   w: 320, h: 580 },
  big_house_grey:   { x: 320, y: 0,   w: 350, h: 580 },
  big_house_red:    { x: 670, y: 0,   w: 350, h: 580 },
};

/**
 * Character_Walk.png is 160x192 — 4 cols x 4 rows of 40x48 frames.
 * Row 0 = right-facing, Row 1 = left-facing, Row 2 = up (back), Row 3 = down (front).
 */
export const CHARACTER_FRAME_SIZE = { w: 40, h: 48 };
export function characterFrame(dir: 0 | 1 | 2 | 3, frame: 0 | 1 | 2 | 3): TileFrame {
  return {
    x: frame * CHARACTER_FRAME_SIZE.w,
    y: dir * CHARACTER_FRAME_SIZE.h,
    w: CHARACTER_FRAME_SIZE.w,
    h: CHARACTER_FRAME_SIZE.h,
  };
}

// ---------- Loader ----------

let atlasPromise: Promise<Map<string, Texture>> | null = null;

function setNearest(t: Texture | null | undefined) {
  if (t?.source) t.source.scaleMode = 'nearest';
}

async function loadStandalones(map: Map<string, Texture>, files: Record<string, string>) {
  const aliases = Object.entries(files).map(([alias, src]) => ({ alias, src }));
  if (aliases.length === 0) return;
  Assets.add(aliases);
  const result = await Assets.load<Texture>(aliases.map(a => a.alias));
  if (result instanceof Map) {
    for (const [k, v] of result) {
      map.set(k as string, v as Texture);
      setNearest(v as Texture);
    }
  } else if (result && typeof result === 'object') {
    for (const [k, v] of Object.entries(result as Record<string, Texture>)) {
      map.set(k, v);
      setNearest(v);
    }
  }
}

async function sliceSheet(
  map: Map<string, Texture>,
  alias: string,
  url: string,
  frames: Record<string, TileFrame>,
  prefix = '',
) {
  Assets.add({ alias, src: url });
  const sheet = await Assets.load<Texture>(alias);
  setNearest(sheet);
  for (const [name, f] of Object.entries(frames)) {
    const tex = new Texture({
      source: sheet.source,
      frame: new Rectangle(f.x, f.y, f.w, f.h),
    });
    map.set(prefix + name, tex);
  }
  return sheet;
}

export interface TopdownAtlas {
  textures: Map<string, Texture>;
  characterSheet: Texture | null;
}

export function loadTopdownAtlas(): Promise<TopdownAtlas> {
  if (atlasPromise) return atlasPromise.then(textures => ({
    textures,
    characterSheet: textures.get('__character_sheet') as Texture | null,
  }));
  atlasPromise = (async () => {
    const map = new Map<string, Texture>();

    // Parallel-ish load of standalone sprite groups
    await Promise.all([
      loadStandalones(map, BUILDING_FILES),
      loadStandalones(map, DECOR_FILES),
      loadStandalones(map, PROP_FILES),
    ]);

    // Sliced sheets
    await sliceSheet(map, 'topdown_ground', `${BASE}/terrain/ground.png`, GROUND_FRAMES);
    await sliceSheet(map, 'topdown_big_houses', `${BASE}/buildings/big_houses.png`, BIG_HOUSE_FRAMES);

    // Character sheet — store the whole texture so renderer can slice frames per-frame for animation
    Assets.add({ alias: 'topdown_character_walk', src: `${BASE}/characters/character_walk.png` });
    const charSheet = await Assets.load<Texture>('topdown_character_walk');
    setNearest(charSheet);
    map.set('__character_sheet', charSheet);

    return map;
  })();

  return atlasPromise.then(textures => ({
    textures,
    characterSheet: textures.get('__character_sheet') as Texture | null,
  }));
}

export function getTopdownTexture(atlas: TopdownAtlas, slug: string): Texture {
  return atlas.textures.get(slug) ?? Texture.EMPTY;
}
