import { Assets, Texture } from 'pixi.js';

const BASE = '/assets/kenney';

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
  if (slug.startsWith('medievalStructure')) return `${BASE}/buildings/${slug}.png`;
  if (slug.startsWith('medievalUnit')) return `${BASE}/units/${slug}.png`;
  if (slug.startsWith('medievalEnvironment')) return `${BASE}/environment/${slug}.png`;
  return slug;
};

let atlasPromise: Promise<Map<string, Texture>> | null = null;

export function loadAtlas(): Promise<Map<string, Texture>> {
  if (atlasPromise) return atlasPromise;
  const slugs = [...BUILDING_SLUGS, ...UNIT_SLUGS, ...ENV_SLUGS];
  atlasPromise = (async () => {
    const map = new Map<string, Texture>();
    // Load in parallel via Pixi Assets
    const entries = slugs.map(s => ({ alias: s, src: slugToUrl(s) }));
    Assets.add(entries);
    const textures = await Assets.load<Texture>(entries.map(e => e.alias));
    if (textures instanceof Map) {
      for (const [k, v] of textures) map.set(k as string, v as Texture);
    } else if (typeof textures === 'object' && textures) {
      for (const [k, v] of Object.entries(textures as Record<string, Texture>)) {
        map.set(k, v);
      }
    }
    // Make sure all slugs have something — fall back to whatever loaded
    for (const s of slugs) {
      if (!map.has(s)) {
        try {
          const t = await Assets.load<Texture>(slugToUrl(s));
          map.set(s, t);
        } catch { /* ignore */ }
      }
    }
    return map;
  })();
  return atlasPromise;
}

export function getTexture(map: Map<string, Texture>, slug: string): Texture {
  return map.get(slug) ?? Texture.EMPTY;
}
