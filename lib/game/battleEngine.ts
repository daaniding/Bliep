/**
 * Island Battle Engine
 *
 * Manages an on-island battle: enemy warriors march toward buildings,
 * towers spawn archers that shoot arrows, buildings take damage and
 * can be destroyed. All visual — the actual game outcome (win/lose,
 * coins, trophies) is pre-computed; this just animates the result.
 *
 * Usage:
 *   const battle = createBattle(camp, buildings, won);
 *   // in ticker: battle.tick(dt);
 *   // battle.phase tells you when it's done
 */

import type { PveCamp } from '@/lib/pveCamps';
import type { PlacedBuilding } from '@/lib/cityStore';
import { TILE_W, TILE_H } from './iso';

// ---- Types ----

export interface BattleEnemy {
  id: number;
  x: number;          // screen coords (set by CityCanvas using gridToScreen)
  y: number;
  targetX: number;
  targetY: number;
  targetBuildingId?: string;
  hp: number;
  maxHp: number;
  speed: number;       // pixels per second
  state: 'walk' | 'attack' | 'dead';
  attackTimer: number;
  facingLeft: boolean;
  animFrame: number;
  animTimer: number;
}

export interface BattleArcher {
  id: number;
  x: number;
  y: number;
  towerId: string;
  state: 'idle' | 'shoot';
  shootTimer: number;
  shootCooldown: number;
  targetEnemyId: number | null;
  animFrame: number;
  animTimer: number;
}

export interface BattleArrow {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  angle: number;
}

export interface BattleFx {
  id: number;
  x: number;
  y: number;
  type: 'explosion' | 'fire';
  frame: number;
  timer: number;
  done: boolean;
}

export interface BuildingHp {
  buildingId: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export type BattlePhase = 'spawn' | 'fight' | 'resolve' | 'done';

export interface BattleState {
  phase: BattlePhase;
  elapsed: number;
  won: boolean;         // pre-computed outcome
  enemies: BattleEnemy[];
  archers: BattleArcher[];
  arrows: BattleArrow[];
  fx: BattleFx[];
  buildingHp: Map<string, BuildingHp>;
  nextId: number;
  /** Land edge cells for spawning enemies on the coast (set by BattleIsland). */
  landEdgeCells?: Array<{ gx: number; gy: number }>;
}

// ---- Config ----

const ENEMY_SPEED = 40;            // px/s
const ENEMY_ATTACK_INTERVAL = 1.2; // seconds between attacks
const ENEMY_DAMAGE = 8;            // per hit to buildings
const ARROW_SPEED = 250;           // px/s
const ARROW_DAMAGE = 25;           // per arrow to enemies
const ARCHER_SHOOT_COOLDOWN = 1.5; // seconds between shots
const BUILDING_HP_PER_LEVEL = 30;
const SPAWN_INTERVAL = 0.4;        // seconds between enemy spawns
const RESOLVE_DURATION = 2.0;

// ---- Create ----

export function createBattle(
  camp: PveCamp,
  buildings: PlacedBuilding[],
  won: boolean,
  /** Grid origin for converting grid→screen. */
  originX: number,
  originY: number,
): BattleState {
  // Initialize building HP for non-decorative buildings
  const buildingHp = new Map<string, BuildingHp>();
  const combatTypes = new Set(['house', 'farm', 'barracks', 'wall', 'tower', 'fountain', 'castle']);
  for (const b of buildings) {
    if (combatTypes.has(b.type)) {
      const maxHp = b.level * BUILDING_HP_PER_LEVEL;
      buildingHp.set(b.id, { buildingId: b.id, hp: maxHp, maxHp, destroyed: false });
    }
  }

  return {
    phase: 'spawn',
    elapsed: 0,
    won,
    enemies: [],
    archers: [],
    arrows: [],
    fx: [],
    buildingHp,
    nextId: 1,
  };
}

// ---- Spawn helpers ----

/** Pick a random spawn position on the island coast. */
function randomEdgePosition(
  originX: number,
  originY: number,
  islandBbox: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  landEdgeCells?: Array<{ gx: number; gy: number }>,
): { x: number; y: number } {
  // Use actual land edge cells if available — enemies spawn on the coast
  if (landEdgeCells && landEdgeCells.length > 0) {
    const cell = landEdgeCells[Math.floor(Math.random() * landEdgeCells.length)];
    return {
      x: originX + cell.gx * TILE_W + TILE_W / 2,
      y: originY + cell.gy * TILE_H + TILE_H / 2,
    };
  }
  // Fallback: random edge of bbox
  const side = Math.floor(Math.random() * 4);
  let gx: number, gy: number;
  switch (side) {
    case 0: gx = islandBbox.minGx + Math.random() * (islandBbox.maxGx - islandBbox.minGx); gy = islandBbox.minGy; break;
    case 1: gx = islandBbox.maxGx; gy = islandBbox.minGy + Math.random() * (islandBbox.maxGy - islandBbox.minGy); break;
    case 2: gx = islandBbox.minGx + Math.random() * (islandBbox.maxGx - islandBbox.minGx); gy = islandBbox.maxGy; break;
    default: gx = islandBbox.minGx; gy = islandBbox.minGy + Math.random() * (islandBbox.maxGy - islandBbox.minGy); break;
  }
  return { x: originX + gx * TILE_W + TILE_W / 2, y: originY + gy * TILE_H + TILE_H / 2 };
}

/** How many enemies to spawn for this camp. */
function enemyCount(camp: PveCamp): number {
  return camp.spriteCount + 2; // base count + 2 extra for visual density
}

// ---- Tick ----

export function tickBattle(
  state: BattleState,
  dt: number, // seconds
  buildings: PlacedBuilding[],
  originX: number,
  originY: number,
  islandBbox: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  camp: PveCamp,
): BattleState {
  state.elapsed += dt;

  switch (state.phase) {
    case 'spawn':
      tickSpawn(state, dt, buildings, originX, originY, islandBbox, camp);
      break;
    case 'fight':
      tickFight(state, dt, buildings, originX, originY);
      break;
    case 'resolve':
      tickResolve(state, dt);
      break;
    case 'done':
      break;
  }

  // Always tick FX
  tickFx(state, dt);

  return state;
}

function tickSpawn(
  state: BattleState,
  dt: number,
  buildings: PlacedBuilding[],
  originX: number,
  originY: number,
  islandBbox: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  camp: PveCamp,
) {
  const total = enemyCount(camp);
  const spawnedSoFar = state.enemies.length;

  if (spawnedSoFar < total) {
    // Check if it's time for next spawn
    const nextSpawnAt = spawnedSoFar * SPAWN_INTERVAL;
    if (state.elapsed >= nextSpawnAt) {
      // Pick a random target building
      const targetBuildings = buildings.filter(b =>
        ['house', 'farm', 'barracks', 'tower', 'fountain'].includes(b.type) &&
        !state.buildingHp.get(b.id)?.destroyed
      );
      const target = targetBuildings[Math.floor(Math.random() * targetBuildings.length)];
      if (!target) return;

      const pos = randomEdgePosition(originX, originY, islandBbox, state.landEdgeCells);
      const fp = { w: 1, h: 1 }; // simplified
      const targetX = originX + (target.gx + fp.w / 2) * TILE_W;
      const targetY = originY + (target.gy + fp.h / 2) * TILE_H;

      const hpBase = 40 + camp.defense * 2;
      state.enemies.push({
        id: state.nextId++,
        x: pos.x,
        y: pos.y,
        targetX,
        targetY,
        targetBuildingId: target.id,
        hp: hpBase,
        maxHp: hpBase,
        speed: ENEMY_SPEED + Math.random() * 15,
        state: 'walk',
        attackTimer: 0,
        facingLeft: targetX < pos.x,
        animFrame: 0,
        animTimer: 0,
      });
    }
  }

  // Also spawn archers from towers
  if (state.archers.length === 0) {
    const towers = buildings.filter(b => b.type === 'tower');
    for (const tower of towers) {
      const tx = originX + (tower.gx + 1) * TILE_W; // center of 2×2
      const ty = originY + (tower.gy + 1) * TILE_H;
      state.archers.push({
        id: state.nextId++,
        x: tx,
        y: ty - 20, // slightly above tower
        towerId: tower.id,
        state: 'idle',
        shootTimer: 0,
        shootCooldown: Math.max(0.6, ARCHER_SHOOT_COOLDOWN - tower.level * 0.08),
        targetEnemyId: null,
        animFrame: 0,
        animTimer: 0,
      });
    }
  }

  // Switch to fight phase once all spawned
  if (spawnedSoFar >= total) {
    state.phase = 'fight';
    state.elapsed = 0;
  }
}

function tickFight(
  state: BattleState,
  dt: number,
  buildings: PlacedBuilding[],
  originX: number,
  originY: number,
) {
  // Move enemies
  for (const enemy of state.enemies) {
    if (enemy.state === 'dead') continue;

    if (enemy.state === 'walk') {
      const dx = enemy.targetX - enemy.x;
      const dy = enemy.targetY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TILE_W * 1.2) {
        // Reached target — start attacking
        enemy.state = 'attack';
        enemy.attackTimer = 0;
      } else {
        const step = enemy.speed * dt;
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
        enemy.facingLeft = dx < 0;
      }
    }

    if (enemy.state === 'attack') {
      enemy.attackTimer += dt;
      if (enemy.attackTimer >= ENEMY_ATTACK_INTERVAL) {
        enemy.attackTimer = 0;
        // Damage target building
        if (enemy.targetBuildingId) {
          const bhp = state.buildingHp.get(enemy.targetBuildingId);
          if (bhp && !bhp.destroyed) {
            bhp.hp -= ENEMY_DAMAGE;
            // Spawn fire on the building
            state.fx.push({
              id: state.nextId++,
              x: enemy.targetX + (Math.random() - 0.5) * 30,
              y: enemy.targetY + (Math.random() - 0.5) * 20 - 20,
              type: 'fire',
              frame: 0,
              timer: 0,
              done: false,
            });
            if (bhp.hp <= 0) {
              bhp.hp = 0;
              bhp.destroyed = true;
              // Explosion on destroyed building
              state.fx.push({
                id: state.nextId++,
                x: enemy.targetX,
                y: enemy.targetY - 20,
                type: 'explosion',
                frame: 0,
                timer: 0,
                done: false,
              });
              // Find a new target
              const alive = [...state.buildingHp.entries()]
                .filter(([, h]) => !h.destroyed)
                .map(([id]) => buildings.find(b => b.id === id))
                .filter(Boolean) as PlacedBuilding[];
              if (alive.length > 0) {
                const next = alive[Math.floor(Math.random() * alive.length)];
                enemy.targetBuildingId = next.id;
                enemy.targetX = originX + (next.gx + 0.5) * TILE_W;
                enemy.targetY = originY + (next.gy + 0.5) * TILE_H;
                enemy.state = 'walk';
              }
            }
          }
        }
      }
    }

    // Anim
    enemy.animTimer += dt;
    if (enemy.animTimer > 0.15) {
      enemy.animTimer = 0;
      enemy.animFrame++;
    }
  }

  // Archers shoot
  for (const archer of state.archers) {
    archer.shootTimer += dt;

    if (archer.shootTimer >= archer.shootCooldown) {
      // Find nearest alive enemy
      let closest: BattleEnemy | null = null;
      let closestDist = Infinity;
      for (const e of state.enemies) {
        if (e.state === 'dead') continue;
        const dx = e.x - archer.x;
        const dy = e.y - archer.y;
        const d = dx * dx + dy * dy;
        if (d < closestDist) {
          closestDist = d;
          closest = e;
        }
      }

      if (closest) {
        archer.shootTimer = 0;
        archer.state = 'shoot';
        archer.targetEnemyId = closest.id;

        // Spawn arrow
        const angle = Math.atan2(closest.y - archer.y, closest.x - archer.x);
        state.arrows.push({
          id: state.nextId++,
          x: archer.x,
          y: archer.y,
          targetX: closest.x,
          targetY: closest.y,
          speed: ARROW_SPEED,
          damage: ARROW_DAMAGE,
          angle,
        });
      }
    }

    archer.animTimer += dt;
    if (archer.animTimer > 0.12) {
      archer.animTimer = 0;
      archer.animFrame++;
      if (archer.state === 'shoot' && archer.animFrame > 7) {
        archer.state = 'idle';
        archer.animFrame = 0;
      }
    }
  }

  // Move arrows
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const arrow = state.arrows[i];
    const dx = arrow.targetX - arrow.x;
    const dy = arrow.targetY - arrow.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      // Hit — damage nearest enemy at target
      for (const e of state.enemies) {
        if (e.state === 'dead') continue;
        const ex = e.x - arrow.targetX;
        const ey = e.y - arrow.targetY;
        if (Math.sqrt(ex * ex + ey * ey) < TILE_W) {
          e.hp -= arrow.damage;
          if (e.hp <= 0) {
            e.state = 'dead';
            state.fx.push({
              id: state.nextId++,
              x: e.x,
              y: e.y - 10,
              type: 'explosion',
              frame: 0,
              timer: 0,
              done: false,
            });
          }
          break;
        }
      }
      state.arrows.splice(i, 1);
    } else {
      const step = arrow.speed * dt;
      arrow.x += (dx / dist) * step;
      arrow.y += (dy / dist) * step;
      arrow.angle = Math.atan2(dy, dx);
    }
  }

  // Check win/lose condition
  // If won: all enemies should die. If lost: buildings get destroyed.
  // Since outcome is predetermined, we steer toward it:
  const aliveEnemies = state.enemies.filter(e => e.state !== 'dead').length;
  const aliveBuildings = [...state.buildingHp.values()].filter(h => !h.destroyed).length;

  if (state.won) {
    // Player wins — enemies should all die eventually
    // If fight has gone on >6s and enemies remain, boost archer damage
    if (state.elapsed > 6 && aliveEnemies > 0) {
      for (const e of state.enemies) {
        if (e.state !== 'dead') {
          e.hp -= dt * 30; // forced attrition
          if (e.hp <= 0) {
            e.state = 'dead';
            state.fx.push({ id: state.nextId++, x: e.x, y: e.y - 10, type: 'explosion', frame: 0, timer: 0, done: false });
          }
        }
      }
    }
    if (aliveEnemies === 0) {
      state.phase = 'resolve';
      state.elapsed = 0;
    }
  } else {
    // Player loses — some buildings should be destroyed
    // After 8s force remaining enemies to win faster
    if (state.elapsed > 8) {
      for (const [, bhp] of state.buildingHp) {
        if (!bhp.destroyed) {
          bhp.hp -= dt * 20;
          if (bhp.hp <= 0) {
            bhp.hp = 0;
            bhp.destroyed = true;
            state.fx.push({ id: state.nextId++, x: 0, y: 0, type: 'explosion', frame: 0, timer: 0, done: false });
          }
        }
      }
    }
    // End when enough damage is done or >12s
    if (aliveBuildings <= Math.floor(state.buildingHp.size * 0.4) || state.elapsed > 12) {
      // Kill remaining enemies (they retreat)
      for (const e of state.enemies) {
        if (e.state !== 'dead') e.state = 'dead';
      }
      state.phase = 'resolve';
      state.elapsed = 0;
    }
  }
}

function tickResolve(state: BattleState, dt: number) {
  if (state.elapsed >= RESOLVE_DURATION) {
    state.phase = 'done';
  }
}

function tickFx(state: BattleState, dt: number) {
  for (const fx of state.fx) {
    if (fx.done) continue;
    fx.timer += dt;
    const frameTime = fx.type === 'explosion' ? 0.08 : 0.12;
    const maxFrames = fx.type === 'explosion' ? 8 : 8;
    fx.frame = Math.floor(fx.timer / frameTime);
    if (fx.frame >= maxFrames) {
      fx.done = true;
    }
  }
  // Clean up old done fx
  for (let i = state.fx.length - 1; i >= 0; i--) {
    if (state.fx[i].done && state.fx[i].timer > 2) {
      state.fx.splice(i, 1);
    }
  }
}

/** Check if the battle is completely finished. */
export function isBattleDone(state: BattleState): boolean {
  return state.phase === 'done';
}
