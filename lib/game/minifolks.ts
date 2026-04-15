import { Assets, Rectangle, Texture } from 'pixi.js';

const BASE = '/assets/topdown/minifolks';

/**
 * Minifolks Forest Animals (pixel art pack).
 *
 * All animals except bird are laid out as 32×32 cells in a grid. Bird is
 * 16×16. Each row in a sheet is a different pose/direction; for Bliep we
 * just slice row 0 (top row) as a generic walk-cycle animation. The real
 * Minifolks pack has per-direction rows but implementing 4-way directional
 * sprites would require per-frame direction logic — we keep it simple and
 * flip the sprite horizontally based on movement direction at runtime.
 */

export interface AnimalSheet {
  /** Walk-cycle frames (first row of the sheet). */
  frames: Texture[];
  frameW: number;
  frameH: number;
}

export interface MinifolksAnimals {
  bird: AnimalSheet;
  bunny: AnimalSheet;
  deer: AnimalSheet;
  fox: AnimalSheet;
  boar: AnimalSheet;
  wolf: AnimalSheet;
  bear: AnimalSheet;
}

let cached: MinifolksAnimals | null = null;

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

export async function loadMinifolks(): Promise<MinifolksAnimals> {
  if (cached) return cached;

  const [bird, bunny, deer, fox, boar, wolf, bear] = await Promise.all([
    Assets.load<Texture>(`${BASE}/bird.png`),
    Assets.load<Texture>(`${BASE}/bunny.png`),
    Assets.load<Texture>(`${BASE}/deer.png`),
    Assets.load<Texture>(`${BASE}/fox.png`),
    Assets.load<Texture>(`${BASE}/boar.png`),
    Assets.load<Texture>(`${BASE}/wolf.png`),
    Assets.load<Texture>(`${BASE}/bear.png`),
  ]);

  const setNearest = (t: Texture) => { if (t.source) t.source.scaleMode = 'nearest'; };
  for (const t of [bird, bunny, deer, fox, boar, wolf, bear]) setNearest(t);

  cached = {
    bird:  { frames: sliceRow(bird, 16, 16, 4),  frameW: 16, frameH: 16 },
    bunny: { frames: sliceRow(bunny, 32, 32, 4), frameW: 32, frameH: 32 },
    deer:  { frames: sliceRow(deer, 32, 32, 4),  frameW: 32, frameH: 32 },
    fox:   { frames: sliceRow(fox, 32, 32, 4),   frameW: 32, frameH: 32 },
    boar:  { frames: sliceRow(boar, 32, 32, 4),  frameW: 32, frameH: 32 },
    wolf:  { frames: sliceRow(wolf, 32, 32, 4),  frameW: 32, frameH: 32 },
    bear:  { frames: sliceRow(bear, 32, 32, 4),  frameW: 32, frameH: 32 },
  };
  return cached;
}

export type AnimalKind = keyof MinifolksAnimals;

export const ANIMAL_KINDS: AnimalKind[] = [
  'bunny', 'deer', 'fox', 'boar', 'wolf', 'bear', 'bird',
];
