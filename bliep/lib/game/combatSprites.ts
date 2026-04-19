import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Combat sprite loader for on-island battles.
 *
 * Enemies swapped to side-view sprite packs under /assets/enemies/*.
 * Each camp mapped to a different enemy type:
 *   bandiet → soldier, wolven → warrior, fort → orc,
 *   goblin  → skeleton, draak  → samurai.
 *
 * Blue defenders (barracks troops) and blue archers (on towers) stay
 * Tiny Swords top-down units.
 */

const UNITS = '/assets/topdown/units';
const FX = '/assets/topdown/fx';

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
  frameH: number;
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

export interface CombatSprites {
  enemies: Record<string, UnitFrames>;
  blueWarrior: UnitFrames;
  blueLancer: UnitFrames;
  archer: ArcherFrames;
  arrow: Texture;
  fx: FxFrames;
}

// ---- Side-view enemy strip loader (auto frame-count from width/height) ----

async function loadStripAuto(url: string): Promise<{ frames: Texture[]; frameH: number } | null> {
  try {
    const tex = await Assets.load<Texture>(url);
    if (!tex) return null;
    setNearest(tex);
    const fh = tex.frame.height;
    if (fh <= 0) return null;
    const count = Math.max(1, Math.floor(tex.frame.width / fh));
    const fw = Math.floor(tex.frame.width / count);
    const frames: Texture[] = [];
    for (let i = 0; i < count; i++) {
      const t = new Texture({ source: tex.source, frame: new Rectangle(i * fw, 0, fw, fh) });
      setNearest(t);
      frames.push(t);
    }
    return { frames, frameH: fh };
  } catch {
    return null;
  }
}

interface EnemyPaths {
  idle: string;
  walk: string;
  attack: string;
}

const ENEMY_PATHS: Record<string, EnemyPaths> = {
  bandiet: {
    idle:   '/assets/enemies/soldier/idle.png',
    walk:   '/assets/enemies/soldier/walk.png',
    attack: '/assets/enemies/soldier/attack.png',
  },
  wolven: {
    idle:   '/assets/enemies/warrior/idle.png',
    walk:   '/assets/enemies/warrior/walk.png',
    attack: '/assets/enemies/warrior/attack.png',
  },
  fort: {
    idle:   '/assets/enemies/orc/Idle.png',
    walk:   '/assets/enemies/orc/Walk.png',
    attack: '/assets/enemies/orc/Attack_1.png',
  },
  goblin: {
    idle:   '/assets/enemies/skeleton/Skeleton_01_White_Idle.png',
    walk:   '/assets/enemies/skeleton/Skeleton_01_White_Walk.png',
    attack: '/assets/enemies/skeleton/Skeleton_01_White_Attack1.png',
  },
  draak: {
    idle:   '/assets/enemies/samurai/idle.png',
    walk:   '/assets/enemies/samurai/walk.png',
    attack: '/assets/enemies/samurai/attack.png',
  },
};

async function loadSideviewEnemy(paths: EnemyPaths): Promise<UnitFrames> {
  const [idleRes, walkRes, attackRes] = await Promise.all([
    loadStripAuto(paths.idle),
    loadStripAuto(paths.walk),
    loadStripAuto(paths.attack),
  ]);
  const walk = walkRes?.frames ?? [];
  const idle = idleRes?.frames ?? walk;
  const attack = attackRes?.frames ?? walk;
  const frameH = walkRes?.frameH ?? idleRes?.frameH ?? 48;
  return { idle, run: walk, attack, frameH };
}

// ---- Defender loader (unchanged Tiny Swords) ----

async function loadUnit(color: string, unit: string, frameH: number): Promise<UnitFrames> {
  const base = `${UNITS}/${color}/${unit}`;
  const [idle, run, attack] = await Promise.all([
    Assets.load<Texture>(`${base}/idle.png`),
    Assets.load<Texture>(`${base}/run.png`),
    Assets.load<Texture>(`${base}/attack.png`).catch(() => null),
  ]);
  for (const t of [idle, run, attack]) { if (t) setNearest(t); }
  const frameW = frameH;
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

// ---- Public loader ----

let cache: CombatSprites | null = null;

export async function loadCombatSprites(): Promise<CombatSprites> {
  if (cache) return cache;

  const [
    bandiet, wolven, fort, goblin, draak,
    blueWarrior, blueLancer,
    archerIdle, archerShoot, arrowTex,
    explosion, fireSmall, fireLarge,
  ] = await Promise.all([
    loadSideviewEnemy(ENEMY_PATHS.bandiet),
    loadSideviewEnemy(ENEMY_PATHS.wolven),
    loadSideviewEnemy(ENEMY_PATHS.fort),
    loadSideviewEnemy(ENEMY_PATHS.goblin),
    loadSideviewEnemy(ENEMY_PATHS.draak),
    loadUnit('blue', 'warrior', 192),
    loadUnit('blue', 'lancer', 320),
    Assets.load<Texture>(`${UNITS}/blue/archer/idle.png`),
    Assets.load<Texture>(`${UNITS}/blue/archer/shoot.png`),
    Assets.load<Texture>(`${UNITS}/blue/archer/arrow.png`),
    Assets.load<Texture>(`${FX}/explosion.png`),
    Assets.load<Texture>(`${FX}/fire_small.png`),
    Assets.load<Texture>(`${FX}/fire_large.png`),
  ]);

  for (const t of [archerIdle, archerShoot, arrowTex, explosion, fireSmall, fireLarge]) {
    setNearest(t);
  }

  cache = {
    enemies: { bandiet, wolven, fort, goblin, draak },
    blueWarrior,
    blueLancer,
    archer: {
      idle: sliceRow(archerIdle, 192, 192, 6),
      shoot: sliceRow(archerShoot, 192, 192, 8),
    },
    arrow: arrowTex,
    fx: {
      explosion: sliceRow(explosion, 192, 192, 8),
      fireSmall: sliceRow(fireSmall, 64, 64, 8),
      fireLarge: sliceRow(fireLarge, 64, 64, 12),
    },
  };
  return cache;
}
