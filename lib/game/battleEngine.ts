/**
 * Island Battle Engine — REAL simulation
 *
 * No predetermined outcome. Enemies march, towers shoot, defenders fight.
 * The actual battle result depends on your buildings and their levels.
 *
 * Phases: countdown → spawn → fight → resolve → done
 */

import type { PveCamp } from '@/lib/pveCamps';
import type { PlacedBuilding } from '@/lib/cityStore';
import { TILE_W, TILE_H } from './iso';
import { footprintOf } from './buildings';

// ---- Types ----

export interface BattleEnemy {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetBuildingId?: string;
  hp: number;
  maxHp: number;
  speed: number;
  state: 'walk' | 'attack' | 'dead';
  attackTimer: number;
  facingLeft: boolean;
}

export interface BattleDefender {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackTimer: number;
  attackInterval: number;
  state: 'walk' | 'attack' | 'idle' | 'dead';
  targetEnemyId: number | null;
  facingLeft: boolean;
  unitType: 'warrior' | 'lancer';
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
  done: boolean;
}

export interface BuildingHp {
  buildingId: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export type BattlePhase = 'countdown' | 'spawn' | 'fight' | 'resolve' | 'done';

export interface BattleState {
  phase: BattlePhase;
  elapsed: number;
  /** Determined by the actual simulation, not pre-set. null until resolve. */
  won: boolean | null;
  enemies: BattleEnemy[];
  defenders: BattleDefender[];
  archers: BattleArcher[];
  arrows: BattleArrow[];
  fx: BattleFx[];
  buildingHp: Map<string, BuildingHp>;
  nextId: number;
  landEdgeCells: Array<{ gx: number; gy: number }>;
  /** Countdown number (3, 2, 1, 0=fight) */
  countdownNum: number;
  /** Slow-mo factor: 1 = normal, <1 = slow */
  timeScale: number;
  slowMoTimer: number;
}

// ---- Config ----

const ENEMY_SPEED = 45;
const ENEMY_ATTACK_INTERVAL = 1.0;
const ENEMY_DAMAGE = 10;
const ARROW_SPEED = 280;
const ARROW_DAMAGE = 20;
const ARCHER_SHOOT_COOLDOWN = 1.3;
const BUILDING_HP_PER_LEVEL = 40;
const WALL_HP_BONUS = 15; // extra HP per wall level to all buildings
const SPAWN_INTERVAL = 0.5;
const COUNTDOWN_DURATION = 2.4; // seconds total for 3..2..1..VECHT
const RESOLVE_DURATION = 2.5;
const MAX_BATTLE_TIME = 20; // safety cap

// ---- Create ----

export function createBattle(
  camp: PveCamp,
  buildings: PlacedBuilding[],
  originX: number,
  originY: number,
  landEdgeCells: Array<{ gx: number; gy: number }>,
): BattleState {
  // Wall bonus: sum of all wall levels adds HP to every building
  const walls = buildings.filter(b => b.type === 'wall');
  const wallBonus = walls.reduce((s, w) => s + w.level, 0) * WALL_HP_BONUS;

  // Building HP
  const buildingHp = new Map<string, BuildingHp>();
  const combatTypes = new Set(['house', 'farm', 'barracks', 'wall', 'tower', 'fountain']);
  for (const b of buildings) {
    if (combatTypes.has(b.type)) {
      const maxHp = b.level * BUILDING_HP_PER_LEVEL + wallBonus;
      buildingHp.set(b.id, { buildingId: b.id, hp: maxHp, maxHp, destroyed: false });
    }
  }

  // Defenders from barracks
  const defenders: BattleDefender[] = [];
  let nextId = 1;
  const barracks = buildings.filter(b => b.type === 'barracks');
  for (const b of barracks) {
    const count = Math.min(b.level + 1, 6);
    const fp = footprintOf('barracks');
    const bx = originX + (b.gx + fp.w / 2) * TILE_W;
    const by = originY + (b.gy + fp.h / 2) * TILE_H;
    for (let i = 0; i < count; i++) {
      defenders.push({
        id: nextId++,
        x: bx + (Math.random() - 0.5) * TILE_W * 2,
        y: by + (Math.random() - 0.5) * TILE_H * 2,
        hp: 50 + b.level * 12,
        maxHp: 50 + b.level * 12,
        speed: 55 + Math.random() * 10,
        damage: 10 + b.level * 4,
        attackTimer: 0,
        attackInterval: 0.9,
        state: 'idle',
        targetEnemyId: null,
        facingLeft: false,
        unitType: b.level >= 6 ? 'lancer' : 'warrior',
      });
    }
  }

  return {
    phase: 'countdown',
    elapsed: 0,
    won: null,
    enemies: [],
    defenders,
    archers: [],
    arrows: [],
    fx: [],
    buildingHp,
    nextId,
    landEdgeCells,
    countdownNum: 3,
    timeScale: 1,
    slowMoTimer: 0,
  };
}

// ---- Helpers ----

function randomEdgePosition(
  originX: number, originY: number,
  landEdgeCells: Array<{ gx: number; gy: number }>,
): { x: number; y: number } {
  if (landEdgeCells.length > 0) {
    const cell = landEdgeCells[Math.floor(Math.random() * landEdgeCells.length)];
    return {
      x: originX + cell.gx * TILE_W + TILE_W / 2,
      y: originY + cell.gy * TILE_H + TILE_H / 2,
    };
  }
  return { x: originX, y: originY };
}

function enemyCount(camp: PveCamp): number {
  return camp.spriteCount + 3;
}

function enemyHp(camp: PveCamp): number {
  return 30 + camp.defense * 3;
}

// ---- Main tick ----

export function tickBattle(
  state: BattleState,
  rawDt: number,
  buildings: PlacedBuilding[],
  originX: number,
  originY: number,
  islandBbox: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  camp: PveCamp,
): BattleState {
  // Slow-mo
  if (state.slowMoTimer > 0) {
    state.slowMoTimer -= rawDt;
    state.timeScale = 0.25;
  } else {
    state.timeScale = 1;
  }
  const dt = rawDt * state.timeScale;
  state.elapsed += dt;

  switch (state.phase) {
    case 'countdown': tickCountdown(state); break;
    case 'spawn': tickSpawn(state, dt, buildings, originX, originY, camp); break;
    case 'fight': tickFight(state, dt, buildings, originX, originY, camp); break;
    case 'resolve': tickResolve(state, dt); break;
  }

  // Clean up done FX
  for (let i = state.fx.length - 1; i >= 0; i--) {
    if (state.fx[i].done) state.fx.splice(i, 1);
  }

  return state;
}

function tickCountdown(state: BattleState) {
  const num = Math.max(0, 3 - Math.floor(state.elapsed / (COUNTDOWN_DURATION / 4)));
  state.countdownNum = num;
  if (state.elapsed >= COUNTDOWN_DURATION) {
    state.phase = 'spawn';
    state.elapsed = 0;
  }
}

function tickSpawn(
  state: BattleState, dt: number,
  buildings: PlacedBuilding[],
  originX: number, originY: number,
  camp: PveCamp,
) {
  const total = enemyCount(camp);

  if (state.enemies.length < total) {
    const nextSpawnAt = state.enemies.length * SPAWN_INTERVAL;
    if (state.elapsed >= nextSpawnAt) {
      const targetBuildings = buildings.filter(b =>
        ['house', 'farm', 'barracks', 'tower', 'fountain'].includes(b.type) &&
        !state.buildingHp.get(b.id)?.destroyed
      );
      const target = targetBuildings[Math.floor(Math.random() * targetBuildings.length)];
      if (!target) { state.phase = 'fight'; state.elapsed = 0; return; }

      const pos = randomEdgePosition(originX, originY, state.landEdgeCells);
      const tfp = footprintOf(target.type);
      const targetX = originX + (target.gx + tfp.w / 2) * TILE_W;
      const targetY = originY + (target.gy + tfp.h / 2) * TILE_H;

      state.enemies.push({
        id: state.nextId++,
        x: pos.x, y: pos.y,
        targetX, targetY,
        targetBuildingId: target.id,
        hp: enemyHp(camp),
        maxHp: enemyHp(camp),
        speed: ENEMY_SPEED + Math.random() * 15,
        state: 'walk',
        attackTimer: 0,
        facingLeft: targetX < pos.x,
      });
    }
  }

  // Archers from towers
  if (state.archers.length === 0) {
    for (const tower of buildings.filter(b => b.type === 'tower')) {
      const tfp = footprintOf('tower');
      state.archers.push({
        id: state.nextId++,
        x: originX + (tower.gx + tfp.w / 2) * TILE_W,
        y: originX + (tower.gy + tfp.h / 2) * TILE_H - 20,
        towerId: tower.id,
        state: 'idle',
        shootTimer: 0,
        shootCooldown: Math.max(0.5, ARCHER_SHOOT_COOLDOWN - tower.level * 0.1),
        targetEnemyId: null,
      });
    }
  }

  if (state.enemies.length >= total) {
    state.phase = 'fight';
    state.elapsed = 0;
  }
}

function tickFight(
  state: BattleState, dt: number,
  buildings: PlacedBuilding[],
  originX: number, originY: number,
  camp: PveCamp,
) {
  // ---- Enemies ----
  for (const e of state.enemies) {
    if (e.state === 'dead') continue;

    if (e.state === 'walk') {
      const dx = e.targetX - e.x;
      const dy = e.targetY - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TILE_W * 1.2) {
        e.state = 'attack';
        e.attackTimer = 0;
      } else {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
        e.facingLeft = dx < 0;
      }
    }

    if (e.state === 'attack') {
      e.attackTimer += dt;
      if (e.attackTimer >= ENEMY_ATTACK_INTERVAL && e.targetBuildingId) {
        e.attackTimer = 0;
        const bhp = state.buildingHp.get(e.targetBuildingId);
        if (bhp && !bhp.destroyed) {
          bhp.hp -= ENEMY_DAMAGE;
          state.fx.push({
            id: state.nextId++,
            x: e.targetX + (Math.random() - 0.5) * 30,
            y: e.targetY - 20 + (Math.random() - 0.5) * 20,
            type: 'fire', done: false,
          });
          if (bhp.hp <= 0) {
            bhp.hp = 0;
            bhp.destroyed = true;
            state.fx.push({ id: state.nextId++, x: e.targetX, y: e.targetY - 20, type: 'explosion', done: false });
            state.slowMoTimer = 0.4; // slow-mo on building destroy
            retargetEnemy(e, state, buildings, originX, originY);
          }
        } else {
          retargetEnemy(e, state, buildings, originX, originY);
        }
      }
    }
  }

  // ---- Archers ----
  for (const a of state.archers) {
    a.shootTimer += dt;
    if (a.shootTimer >= a.shootCooldown) {
      const closest = findClosestEnemy(state.enemies, a.x, a.y);
      if (closest) {
        a.shootTimer = 0;
        a.state = 'shoot';
        a.targetEnemyId = closest.id;
        state.arrows.push({
          id: state.nextId++,
          x: a.x, y: a.y,
          targetX: closest.x, targetY: closest.y,
          speed: ARROW_SPEED,
          damage: ARROW_DAMAGE,
          angle: Math.atan2(closest.y - a.y, closest.x - a.x),
        });
      }
    }
    // Reset shoot state after brief delay
    if (a.state === 'shoot' && a.shootTimer > 0.3) {
      a.state = 'idle';
    }
  }

  // ---- Arrows ----
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const arrow = state.arrows[i];
    const dx = arrow.targetX - arrow.x;
    const dy = arrow.targetY - arrow.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 12) {
      // Hit nearest enemy
      for (const e of state.enemies) {
        if (e.state === 'dead') continue;
        if (Math.hypot(e.x - arrow.targetX, e.y - arrow.targetY) < TILE_W) {
          e.hp -= arrow.damage;
          if (e.hp <= 0) {
            killEnemy(e, state);
          }
          break;
        }
      }
      state.arrows.splice(i, 1);
    } else {
      arrow.x += (dx / dist) * arrow.speed * dt;
      arrow.y += (dy / dist) * arrow.speed * dt;
      arrow.angle = Math.atan2(dy, dx);
    }
  }

  // ---- Defenders ----
  for (const d of state.defenders) {
    if (d.state === 'dead') continue;

    // Find target
    if (d.state === 'idle') {
      const target = findClosestEnemy(state.enemies, d.x, d.y);
      if (target) {
        d.targetEnemyId = target.id;
        d.state = 'walk';
      }
    }

    if (d.state === 'walk' && d.targetEnemyId !== null) {
      const target = state.enemies.find(e => e.id === d.targetEnemyId);
      if (!target || target.state === 'dead') {
        d.targetEnemyId = null;
        d.state = 'idle';
        continue;
      }
      const dx = target.x - d.x;
      const dy = target.y - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      d.facingLeft = dx < 0;
      if (dist < TILE_W * 0.8) {
        d.state = 'attack';
        d.attackTimer = 0;
      } else {
        d.x += (dx / dist) * d.speed * dt;
        d.y += (dy / dist) * d.speed * dt;
      }
    }

    if (d.state === 'attack') {
      const target = state.enemies.find(e => e.id === d.targetEnemyId);
      if (!target || target.state === 'dead') {
        d.targetEnemyId = null;
        d.state = 'idle';
        continue;
      }
      d.attackTimer += dt;
      if (d.attackTimer >= d.attackInterval) {
        d.attackTimer = 0;
        target.hp -= d.damage;
        if (target.hp <= 0) killEnemy(target, state);
      }
      // Follow if enemy moves away
      if (Math.hypot(target.x - d.x, target.y - d.y) > TILE_W * 1.5) {
        d.state = 'walk';
      }
    }
  }

  // ---- Enemies hit nearby defenders ----
  for (const e of state.enemies) {
    if (e.state !== 'attack') continue;
    for (const d of state.defenders) {
      if (d.state === 'dead') continue;
      if (Math.hypot(d.x - e.x, d.y - e.y) < TILE_W) {
        d.hp -= ENEMY_DAMAGE * 0.4 * dt;
        if (d.hp <= 0) {
          d.state = 'dead';
          state.fx.push({ id: state.nextId++, x: d.x, y: d.y - 10, type: 'explosion', done: false });
        }
      }
    }
  }

  // ---- Win/lose check (REAL simulation) ----
  const aliveEnemies = state.enemies.filter(e => e.state !== 'dead').length;
  const aliveBuildings = [...state.buildingHp.values()].filter(h => !h.destroyed).length;

  // All enemies dead = player wins
  if (aliveEnemies === 0 && state.enemies.length >= enemyCount(camp)) {
    state.won = true;
    state.phase = 'resolve';
    state.elapsed = 0;
  }
  // All buildings destroyed = player loses
  else if (aliveBuildings === 0) {
    state.won = false;
    state.phase = 'resolve';
    state.elapsed = 0;
  }
  // Safety timeout — whoever has more stuff alive wins
  else if (state.elapsed > MAX_BATTLE_TIME) {
    state.won = aliveBuildings > 0;
    // Kill remaining enemies on timeout win
    if (state.won) {
      for (const e of state.enemies) {
        if (e.state !== 'dead') killEnemy(e, state);
      }
    }
    state.phase = 'resolve';
    state.elapsed = 0;
  }
}

function tickResolve(state: BattleState, dt: number) {
  if (state.elapsed >= RESOLVE_DURATION) {
    state.phase = 'done';
  }
}

// ---- Helpers ----

function killEnemy(e: BattleEnemy, state: BattleState) {
  e.state = 'dead';
  state.fx.push({ id: state.nextId++, x: e.x, y: e.y - 10, type: 'explosion', done: false });
  state.slowMoTimer = 0.3;
}

function retargetEnemy(
  e: BattleEnemy, state: BattleState,
  buildings: PlacedBuilding[], originX: number, originY: number,
) {
  const alive = [...state.buildingHp.entries()]
    .filter(([, h]) => !h.destroyed)
    .map(([id]) => buildings.find(b => b.id === id))
    .filter(Boolean) as PlacedBuilding[];
  if (alive.length > 0) {
    const next = alive[Math.floor(Math.random() * alive.length)];
    e.targetBuildingId = next.id;
    const nfp = footprintOf(next.type);
    e.targetX = originX + (next.gx + nfp.w / 2) * TILE_W;
    e.targetY = originY + (next.gy + nfp.h / 2) * TILE_H;
    e.state = 'walk';
  }
}

function findClosestEnemy(enemies: BattleEnemy[], x: number, y: number): BattleEnemy | null {
  let closest: BattleEnemy | null = null;
  let closestDist = Infinity;
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < closestDist) { closestDist = d; closest = e; }
  }
  return closest;
}

export function isBattleDone(state: BattleState): boolean {
  return state.phase === 'done';
}
