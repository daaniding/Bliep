import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Combat sprite loader.
 * Enemies = side-view strips onder /assets/enemies/*.
 * Defenders + archers = Tiny Swords top-down units.
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

// ---- Side-view strip auto-slicer ----

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

interface EnemyPaths { idle: string; walk: string; attack: string; }

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

// ---- Tiny Swords top-down unit (defenders) ----

async function loadUnit(color: string, unit: string, frameH: number): Promise<UnitFrames> {
  const base = `${UNITS}/${color}/${unit}`;
  const [idle, run, attack] = await Promise.all([
    Assets.load<Texture>(`${base}/idle.png`).catch(() => null),
    Assets.load<Texture>(`${base}/run.png`).catch(() => null),
    Assets.load<Texture>(`${base}/attack.png`).catch(() => null),
  ]);
  for (const t of [idle, run, attack]) { if (t) setNearest(t); }
  const frameW = frameH;
  if (!idle && !run) return { idle: [], run: [], attack: [], frameH };
  const src = run ?? idle!;
  const attackFrames = attack
    ? sliceRow(attack, frameW, frameH, 12)
    : sliceRow(src, frameW, frameH, 8);
  return {
    idle: idle ? sliceRow(idle, frameW, frameH, 12) : [],
    run: run ? sliceRow(run, frameW, frameH, 6) : (idle ? sliceRow(idle, frameW, frameH, 6) : []),
    attack: attackFrames,
    frameH,
  };
}

async function safeLoad(url: string): Promise<Texture | null> {
  try { const t = await Assets.load<Texture>(url); if (t) setNearest(t); return t ?? null; }
  catch { return null; }
}

let cache: CombatSprites | null = null;

export async function loadCombatSprites(): Promise<CombatSprites> {
  if (cache) return cache;

  const emptyUnit: UnitFrames = { idle: [], run: [], attack: [], frameH: 48 };

  const [
    bandiet, wolven, fort, goblin, draak,
    blueWarrior, blueLancer,
    archerIdle, arrowTex,
    explosion, fireSmall, fireLarge,
  ] = await Promise.all([
    loadSideviewEnemy(ENEMY_PATHS.bandiet).catch(() => emptyUnit),
    loadSideviewEnemy(ENEMY_PATHS.wolven).catch(() => emptyUnit),
    loadSideviewEnemy(ENEMY_PATHS.fort).catch(() => emptyUnit),
    loadSideviewEnemy(ENEMY_PATHS.goblin).catch(() => emptyUnit),
    loadSideviewEnemy(ENEMY_PATHS.draak).catch(() => emptyUnit),
    loadUnit('blue', 'warrior', 192).catch(() => emptyUnit),
    loadUnit('blue', 'lancer', 320).catch(() => emptyUnit),
    safeLoad(`/assets/walkers2/archer-blue.png`),
    safeLoad(`${UNITS}/blue/archer/arrow.png`),
    safeLoad(`${FX}/explosion.png`),
    safeLoad(`${FX}/fire_small.png`),
    safeLoad(`${FX}/fire_large.png`),
  ]);

  cache = {
    enemies: { bandiet, wolven, fort, goblin, draak },
    blueWarrior,
    blueLancer,
    archer: (() => {
      if (!archerIdle) return { idle: [], shoot: [] };
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
    arrow: arrowTex ?? Texture.WHITE,
    fx: {
      explosion: explosion ? sliceRow(explosion, 192, 192, 8) : [],
      fireSmall: fireSmall ? sliceRow(fireSmall, 64, 64, 8) : [],
      fireLarge: fireLarge ? sliceRow(fireLarge, 64, 64, 12) : [],
    },
  };
  return cache;
}
