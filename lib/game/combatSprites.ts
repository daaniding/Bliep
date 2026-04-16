import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Combat sprite loader for battle animations.
 *
 * Knight sprites: side-view pixel art with idle/run/attack strips.
 * Bandit sprites: walkers3 pack with .meta frame info.
 * Monster sprites: reuse minifolks (wolf, bear, boar) via loadMinifolks().
 */

// ---- Slice helper (same pattern as minifolks.ts) ----

function sliceRow(tex: Texture, frameW: number, frameH: number, count: number): Texture[] {
  const maxFrames = Math.floor(tex.width / frameW);
  const n = Math.min(count, maxFrames);
  const out: Texture[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      new Texture({
        source: tex.source,
        frame: new Rectangle(i * frameW, 0, frameW, frameH),
      }),
    );
  }
  return out;
}

// ---- Knight sprites (/assets/knight/) ----

export interface KnightSprites {
  idle: Texture[];   // 8 frames, 84×84
  run: Texture[];    // 8 frames, 96×84
  attack: Texture[]; // 7 frames, 84×84
}

let knightCache: KnightSprites | null = null;

export async function loadKnightSprites(): Promise<KnightSprites> {
  if (knightCache) return knightCache;

  const [idle, run, attack] = await Promise.all([
    Assets.load<Texture>('/assets/knight/idle-strip.png'),
    Assets.load<Texture>('/assets/knight/run-strip.png'),
    Assets.load<Texture>('/assets/knight/attack1-strip.png'),
  ]);

  for (const t of [idle, run, attack]) {
    if (t.source) t.source.scaleMode = 'nearest';
  }

  knightCache = {
    idle: sliceRow(idle, 84, 84, 8),
    run: sliceRow(run, 96, 84, 8),
    attack: sliceRow(attack, 84, 84, 7),
  };
  return knightCache;
}

// ---- Bandit sprites (/assets/walkers3/) ----

export interface BanditSprites {
  light: Texture[];  // 8 frames, 48×48
  heavy: Texture[];  // 8 frames, 48×48
}

let banditCache: BanditSprites | null = null;

export async function loadBanditSprites(): Promise<BanditSprites> {
  if (banditCache) return banditCache;

  const [light, heavy] = await Promise.all([
    Assets.load<Texture>('/assets/walkers3/light-bandit.png'),
    Assets.load<Texture>('/assets/walkers3/heavy-bandit.png'),
  ]);

  for (const t of [light, heavy]) {
    if (t.source) t.source.scaleMode = 'nearest';
  }

  banditCache = {
    light: sliceRow(light, 48, 48, 8),
    heavy: sliceRow(heavy, 48, 48, 8),
  };
  return banditCache;
}

// ---- All combat sprites bundled ----

export interface CombatSprites {
  knight: KnightSprites;
  bandit: BanditSprites;
}

let allCache: CombatSprites | null = null;

export async function loadCombatSprites(): Promise<CombatSprites> {
  if (allCache) return allCache;
  const [knight, bandit] = await Promise.all([
    loadKnightSprites(),
    loadBanditSprites(),
  ]);
  allCache = { knight, bandit };
  return allCache;
}
