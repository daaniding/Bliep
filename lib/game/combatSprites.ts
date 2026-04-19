import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Combat sprite loader for on-island battles.
 *
 * Each camp has its own enemy type (color + unit class) from Tiny Swords:
 *   Bandiet  → Yellow Pawn    (192px frames)
 *   Wolven   → Yellow Warrior (192px frames)
 *   Fort     → Purple Warrior (192px frames)
 *   Goblin   → Red Lancer    (320px frames)
 *   Draak    → Black Lancer  (320px frames)
 *
 * Defenders are Blue Archers (always).
 */

const UNITS = '/assets/topdown/units';
const FX = '/assets/topdown/fx';

// ---- Slice helper ----

function sliceRow(tex: Texture, frameW: number, frameH: number, count: number): Texture[] {
  const maxFrames = Math.floor(tex.width / frameW);
  const n = Math.min(count, maxFrames);
  const out: Texture[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Texture({
      source: tex.source,
      frame: new Rectangle(i * frameW, 0, frameW, frameH),
    }));
  }
  return out;
}

function setNearest(t: Texture) {
  if (t.source) t.source.scaleMode = 'nearest';
}

// ---- Types ----

export interface UnitFrames {
  idle: Texture[];
  run: Texture[];
  attack: Texture[];
  frameH: number; // 192 or 320 — needed for scaling
}

export interface ArcherFrames {
  idle: Texture[];
  shoot: Texture[];
}

export interface FxFrames {
  explosion: Texture[];
  fireSmall: Texture[];
  fireLarge: Texture[];
}

/** All camp enemy types keyed by camp id. */
export interface CombatSprites {
  enemies: Record<string, UnitFrames>; // keyed by camp id
  /** Blue defenders spawned by barracks. */
  blueWarrior: UnitFrames;
  blueLancer: UnitFrames;
  archer: ArcherFrames;
  arrow: Texture;
  fx: FxFrames;
}

// ---- Loader ----

let cache: CombatSprites | null = null;

async function loadUnit(
  color: string,
  unit: string,
  frameH: number,
): Promise<UnitFrames> {
  const base = `${UNITS}/${color}/${unit}`;
  const [idle, run, attack] = await Promise.all([
    Assets.load<Texture>(`${base}/idle.png`),
    Assets.load<Texture>(`${base}/run.png`),
    Assets.load<Texture>(`${base}/attack.png`).catch(() => null),
  ]);
  for (const t of [idle, run, attack]) { if (t) setNearest(t); }

  const frameW = frameH; // Tiny Swords units are square frames (192×192 or 320×320)
  // Pawns don't have attack — use idle as fallback
  const attackFrames = attack
    ? sliceRow(attack, frameW, frameH, 12)
    : sliceRow(idle, frameW, frameH, 8);

  return {
    idle: sliceRow(idle, frameW, frameH, 12),
    run: sliceRow(run, frameW, frameH, 6),
    attack: attackFrames,
    frameH,
  };
}

export async function loadCombatSprites(): Promise<CombatSprites> {
  if (cache) return cache;

  // Load all enemy types in parallel
  const [
    bandiet, wolven, fort, goblin, draak,
    blueWarrior, blueLancer,
    archerIdle, archerShoot, arrowTex,
    explosion, fireSmall, fireLarge,
  ] = await Promise.all([
    loadUnit('yellow', 'pawn', 192),
    loadUnit('yellow', 'warrior', 192),
    loadUnit('purple', 'warrior', 192),
    loadUnit('red', 'lancer', 320),
    loadUnit('black', 'lancer', 320),
    loadUnit('blue', 'warrior', 192),
    loadUnit('blue', 'lancer', 320),
    Assets.load<Texture>(`/assets/walkers2/archer-blue.png`),
    Assets.load<Texture>(`/assets/walkers2/archer-blue.png`),
    Assets.load<Texture>(`${UNITS}/blue/archer/arrow.png`),
    Assets.load<Texture>(`${FX}/explosion.png`),
    Assets.load<Texture>(`${FX}/fire_small.png`),
    Assets.load<Texture>(`${FX}/fire_large.png`),
  ]);

  for (const t of [archerIdle, archerShoot, arrowTex, explosion, fireSmall, fireLarge]) {
    setNearest(t);
  }

  cache = {
    enemies: {
      bandiet,
      wolven,
      fort,
      goblin,
      draak,
    },
    blueWarrior,
    blueLancer,
    archer: (() => {
      // walkers2/archer-blue.png is a 4-frame horizontal strip
      const fh = archerIdle.frame.height;
      const count = Math.max(1, Math.floor(archerIdle.frame.width / fh));
      const fw = Math.floor(archerIdle.frame.width / count);
      const frames: Texture[] = [];
      for (let i = 0; i < count; i++) {
        const t = new Texture({ source: archerIdle.source, frame: new Rectangle(i * fw, 0, fw, fh) });
        setNearest(t);
        frames.push(t);
      }
      return { idle: frames, shoot: frames };
    })(),
    arrow: arrowTex,
    fx: {
      explosion: sliceRow(explosion, 192, 192, 8),
      fireSmall: sliceRow(fireSmall, 64, 64, 8),
      fireLarge: sliceRow(fireLarge, 64, 64, 12),
    },
  };
  return cache;
}
