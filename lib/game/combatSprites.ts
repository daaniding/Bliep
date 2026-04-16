import { Assets, Rectangle, Texture } from 'pixi.js';

/**
 * Combat sprite loader for on-island battles.
 *
 * Uses Tiny Swords unit sprites (192×192 frames) for:
 * - Blue archers (defenders, spawned from towers/archery buildings)
 * - Red warriors (attackers/enemies, walk toward buildings)
 * - Arrow projectile (64×64 single sprite)
 * - Particle FX: explosion, fire
 *
 * Monsters reuse minifolks (wolf, bear, boar) from minifolks.ts.
 */

const UNITS = '/assets/topdown/units';
const FX = '/assets/topdown/fx';

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

function setNearest(t: Texture) {
  if (t.source) t.source.scaleMode = 'nearest';
}

// ---- Blue Archer (defender) ----

export interface ArcherSprites {
  idle: Texture[];   // 6 frames, 192×192
  shoot: Texture[];  // 8 frames, 192×192
}

// ---- Red Warrior (attacker) ----

export interface EnemyWarriorSprites {
  idle: Texture[];   // 8 frames, 192×192
  run: Texture[];    // 6 frames, 192×192
  attack: Texture[]; // 4 frames, 192×192
}

// ---- FX ----

export interface FxSprites {
  explosion: Texture[];  // 8 frames, 192×192
  fireSmall: Texture[];  // 8 frames, 64×64
  fireLarge: Texture[];  // 12 frames, 64×64
}

// ---- Combined ----

export interface CombatSprites {
  archer: ArcherSprites;
  enemy: EnemyWarriorSprites;
  arrow: Texture;          // single 64×64 sprite
  fx: FxSprites;
}

let cache: CombatSprites | null = null;

export async function loadCombatSprites(): Promise<CombatSprites> {
  if (cache) return cache;

  const [
    archerIdle, archerShoot,
    enemyIdle, enemyRun, enemyAttack,
    arrowTex,
    explosion, fireSmall, fireLarge,
  ] = await Promise.all([
    Assets.load<Texture>(`${UNITS}/blue/archer/idle.png`),
    Assets.load<Texture>(`${UNITS}/blue/archer/shoot.png`),
    Assets.load<Texture>(`${UNITS}/red/warrior/idle.png`),
    Assets.load<Texture>(`${UNITS}/red/warrior/run.png`),
    Assets.load<Texture>(`${UNITS}/red/warrior/attack.png`),
    Assets.load<Texture>(`${UNITS}/blue/archer/arrow.png`),
    Assets.load<Texture>(`${FX}/explosion.png`),
    Assets.load<Texture>(`${FX}/fire_small.png`),
    Assets.load<Texture>(`${FX}/fire_large.png`),
  ]);

  for (const t of [archerIdle, archerShoot, enemyIdle, enemyRun, enemyAttack, arrowTex, explosion, fireSmall, fireLarge]) {
    setNearest(t);
  }

  cache = {
    archer: {
      idle: sliceRow(archerIdle, 192, 192, 6),
      shoot: sliceRow(archerShoot, 192, 192, 8),
    },
    enemy: {
      idle: sliceRow(enemyIdle, 192, 192, 8),
      run: sliceRow(enemyRun, 192, 192, 6),
      attack: sliceRow(enemyAttack, 192, 192, 4),
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
