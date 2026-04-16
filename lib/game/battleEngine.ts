/**
 * Island Battle Engine — wave-based real simulation
 *
 * 3 waves: Scouts → Army → Elite
 * Archers sit ON towers, defenders spawn from barracks.
 * No predetermined outcome — your buildings determine if you win.
 *
 * Phases: countdown → wave1 → wave2 → wave3 → fight → resolve → done
 */

import type { PveCamp } from '@/lib/pveCamps';
import type { PlacedBuilding } from '@/lib/cityStore';
import { TILE_W, TILE_H } from './iso';
import { footprintOf } from './buildings';

// ---- Types ----

export interface BattleEnemy {
  id: number;
  x: number; y: number;
  targetX: number; targetY: number;
  targetBuildingId?: string;
  hp: number; maxHp: number;
  speed: number;
  state: 'walk' | 'attack' | 'dead';
  attackTimer: number;
  facingLeft: boolean;
  /** Visual tier: 'scout' | 'soldier' | 'elite' */
  tier: 'scout' | 'soldier' | 'elite';
}

export interface BattleDefender {
  id: number;
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number; damage: number;
  attackTimer: number; attackInterval: number;
  state: 'walk' | 'attack' | 'idle' | 'dead';
  targetEnemyId: number | null;
  facingLeft: boolean;
  unitType: 'warrior' | 'lancer';
}

export interface BattleArcher {
  id: number;
  /** Fixed position on top of tower. */
  x: number; y: number;
  state: 'idle' | 'shoot';
  shootTimer: number; shootCooldown: number;
}

export interface BattleArrow {
  id: number;
  x: number; y: number;
  targetX: number; targetY: number;
  speed: number; damage: number; angle: number;
}

export interface BattleFx {
  id: number;
  x: number; y: number;
  type: 'explosion' | 'fire';
  done: boolean;
}

export interface BuildingHp {
  buildingId: string;
  hp: number; maxHp: number; destroyed: boolean;
}

export type BattlePhase = 'countdown' | 'spawning' | 'fight' | 'resolve' | 'done';

export interface BattleState {
  phase: BattlePhase;
  elapsed: number;
  won: boolean | null;
  enemies: BattleEnemy[];
  defenders: BattleDefender[];
  archers: BattleArcher[];
  arrows: BattleArrow[];
  fx: BattleFx[];
  buildingHp: Map<string, BuildingHp>;
  nextId: number;
  landEdgeCells: Array<{ gx: number; gy: number }>;
  countdownNum: number;
  timeScale: number;
  slowMoTimer: number;
  /** Wave system: which wave we're on (0-2), enemies per wave. */
  currentWave: number;
  wavesSpawned: number[];  // how many spawned per wave
  waveTotals: number[];    // total per wave
  waveDelay: number;       // delay between waves
}

// ---- Config ----

const ENEMY_SPEED = 48;
const ENEMY_ATTACK_INTERVAL = 0.9;
const ENEMY_DAMAGE = 12;
const ARROW_SPEED = 300;
const ARROW_DAMAGE = 22;
const ARCHER_SHOOT_COOLDOWN = 1.2;
const BUILDING_HP_PER_LEVEL = 45;
const WALL_HP_BONUS = 20;
const SPAWN_INTERVAL = 0.6;
const COUNTDOWN_DURATION = 2.4;
const RESOLVE_DURATION = 2.5;
const MAX_BATTLE_TIME = 25;
const WAVE_PAUSE = 2.0; // seconds between waves

// ---- Create ----

export function createBattle(
  camp: PveCamp,
  buildings: PlacedBuilding[],
  originX: number, originY: number,
  landEdgeCells: Array<{ gx: number; gy: number }>,
): BattleState {
  // Wall bonus
  const wallBonus = buildings.filter(b => b.type === 'wall').reduce((s, w) => s + w.level, 0) * WALL_HP_BONUS;

  // Building HP
  const buildingHp = new Map<string, BuildingHp>();
  for (const b of buildings) {
    if (['house', 'farm', 'barracks', 'wall', 'tower', 'fountain'].includes(b.type)) {
      const maxHp = b.level * BUILDING_HP_PER_LEVEL + wallBonus;
      buildingHp.set(b.id, { buildingId: b.id, hp: maxHp, maxHp, destroyed: false });
    }
  }

  // Defenders from barracks
  const defenders: BattleDefender[] = [];
  let nextId = 1;
  for (const b of buildings.filter(b => b.type === 'barracks')) {
    const count = Math.min(b.level + 1, 6);
    const fp = footprintOf('barracks');
    const bx = originX + (b.gx + fp.w / 2) * TILE_W;
    const by = originY + (b.gy + fp.h / 2) * TILE_H;
    for (let i = 0; i < count; i++) {
      defenders.push({
        id: nextId++,
        x: bx + (Math.random() - 0.5) * TILE_W * 2,
        y: by + (Math.random() - 0.5) * TILE_H * 2,
        hp: 50 + b.level * 12, maxHp: 50 + b.level * 12,
        speed: 55 + Math.random() * 10,
        damage: 10 + b.level * 4,
        attackTimer: 0, attackInterval: 0.9,
        state: 'idle', targetEnemyId: null, facingLeft: false,
        unitType: b.level >= 6 ? 'lancer' : 'warrior',
      });
    }
  }

  // Archers ON towers
  const archers: BattleArcher[] = [];
  for (const tower of buildings.filter(b => b.type === 'tower')) {
    const fp = footprintOf('tower');
    const archersPerTower = Math.min(tower.level, 3); // 1-3 archers based on level
    for (let i = 0; i < archersPerTower; i++) {
      archers.push({
        id: nextId++,
        x: originX + (tower.gx + fp.w / 2) * TILE_W + (i - 1) * 15,
        y: originY + (tower.gy + fp.h / 2) * TILE_H - TILE_H * 0.6,
        state: 'idle', shootTimer: Math.random() * 0.5, // stagger first shots
        shootCooldown: Math.max(0.4, ARCHER_SHOOT_COOLDOWN - tower.level * 0.08),
      });
    }
  }

  // Wave system: Scouts → Army → Elite
  const baseCount = camp.spriteCount + 2;
  const scoutCount = Math.max(2, Math.floor(baseCount * 0.3));
  const armyCount = Math.max(3, Math.floor(baseCount * 0.5));
  const eliteCount = Math.max(1, baseCount - scoutCount - armyCount);

  return {
    phase: 'countdown', elapsed: 0, won: null,
    enemies: [], defenders, archers, arrows: [], fx: [],
    buildingHp, nextId, landEdgeCells,
    countdownNum: 3, timeScale: 1, slowMoTimer: 0,
    currentWave: 0,
    wavesSpawned: [0, 0, 0],
    waveTotals: [scoutCount, armyCount, eliteCount],
    waveDelay: 0,
  };
}

// ---- Helpers ----

function edgePos(originX: number, originY: number, cells: Array<{ gx: number; gy: number }>): { x: number; y: number } {
  if (cells.length > 0) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    return { x: originX + c.gx * TILE_W + TILE_W / 2, y: originY + c.gy * TILE_H + TILE_H / 2 };
  }
  return { x: originX, y: originY };
}

function findClosest(enemies: BattleEnemy[], x: number, y: number): BattleEnemy | null {
  let best: BattleEnemy | null = null, bestD = Infinity;
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function killEnemy(e: BattleEnemy, state: BattleState) {
  e.state = 'dead';
  state.fx.push({ id: state.nextId++, x: e.x, y: e.y - 10, type: 'explosion', done: false });
  state.slowMoTimer = 0.35;
}

function retarget(e: BattleEnemy, state: BattleState, buildings: PlacedBuilding[], ox: number, oy: number) {
  const alive = [...state.buildingHp.entries()].filter(([, h]) => !h.destroyed)
    .map(([id]) => buildings.find(b => b.id === id)).filter(Boolean) as PlacedBuilding[];
  if (alive.length > 0) {
    const t = alive[Math.floor(Math.random() * alive.length)];
    const fp = footprintOf(t.type);
    e.targetBuildingId = t.id;
    e.targetX = ox + (t.gx + fp.w / 2) * TILE_W;
    e.targetY = oy + (t.gy + fp.h / 2) * TILE_H;
    e.state = 'walk';
  }
}

function spawnEnemy(
  state: BattleState, camp: PveCamp, tier: 'scout' | 'soldier' | 'elite',
  buildings: PlacedBuilding[], ox: number, oy: number,
) {
  const targets = buildings.filter(b =>
    ['house', 'farm', 'barracks', 'tower', 'fountain'].includes(b.type) &&
    !state.buildingHp.get(b.id)?.destroyed
  );
  const target = targets[Math.floor(Math.random() * targets.length)];
  if (!target) return;

  const pos = edgePos(ox, oy, state.landEdgeCells);
  const fp = footprintOf(target.type);
  const tx = ox + (target.gx + fp.w / 2) * TILE_W;
  const ty = oy + (target.gy + fp.h / 2) * TILE_H;

  // HP scales by camp + tier
  const baseHp = 25 + camp.defense * 2.5;
  const hpMult = tier === 'scout' ? 0.6 : tier === 'soldier' ? 1.0 : 2.0;
  const speedMult = tier === 'scout' ? 1.3 : tier === 'soldier' ? 1.0 : 0.7;
  const hp = Math.round(baseHp * hpMult);

  state.enemies.push({
    id: state.nextId++,
    x: pos.x, y: pos.y, targetX: tx, targetY: ty,
    targetBuildingId: target.id,
    hp, maxHp: hp,
    speed: ENEMY_SPEED * speedMult + Math.random() * 10,
    state: 'walk', attackTimer: 0,
    facingLeft: tx < pos.x,
    tier,
  });
}

// ---- Tick ----

export function tickBattle(
  state: BattleState, rawDt: number,
  buildings: PlacedBuilding[], ox: number, oy: number,
  _bbox: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  camp: PveCamp,
): BattleState {
  if (state.slowMoTimer > 0) { state.slowMoTimer -= rawDt; state.timeScale = 0.25; }
  else { state.timeScale = 1; }
  const dt = rawDt * state.timeScale;
  state.elapsed += dt;

  switch (state.phase) {
    case 'countdown': {
      state.countdownNum = Math.max(0, 3 - Math.floor(state.elapsed / (COUNTDOWN_DURATION / 4)));
      if (state.elapsed >= COUNTDOWN_DURATION) { state.phase = 'spawning'; state.elapsed = 0; }
      break;
    }

    case 'spawning': {
      const w = state.currentWave;
      if (w >= 3) { state.phase = 'fight'; state.elapsed = 0; break; }

      // Delay between waves
      if (state.waveDelay > 0) {
        state.waveDelay -= dt;
        break;
      }

      const tier: ('scout' | 'soldier' | 'elite')[] = ['scout', 'soldier', 'elite'];
      const spawned = state.wavesSpawned[w];
      const total = state.waveTotals[w];

      if (spawned < total) {
        const nextAt = spawned * SPAWN_INTERVAL;
        if (state.elapsed >= nextAt) {
          spawnEnemy(state, camp, tier[w], buildings, ox, oy);
          state.wavesSpawned[w]++;
        }
      } else {
        // Wave done spawning — check if enough enemies dead to start next wave
        const alive = state.enemies.filter(e => e.state !== 'dead').length;
        if (alive <= Math.ceil(total * 0.3) || state.elapsed > 8) {
          state.currentWave++;
          state.elapsed = 0;
          state.waveDelay = WAVE_PAUSE;
        }
      }

      // Spawn archers already during spawning so they can start shooting
      tickArchers(state, dt);
      tickArrows(state, dt);
      tickEnemyMovement(state, dt, buildings, ox, oy);
      tickDefenders(state, dt);
      tickEnemyVsDefenders(state, dt);
      break;
    }

    case 'fight': {
      tickEnemyMovement(state, dt, buildings, ox, oy);
      tickArchers(state, dt);
      tickArrows(state, dt);
      tickDefenders(state, dt);
      tickEnemyVsDefenders(state, dt);

      // Win/lose
      const alive = state.enemies.filter(e => e.state !== 'dead').length;
      const aliveB = [...state.buildingHp.values()].filter(h => !h.destroyed).length;

      if (alive === 0) {
        state.won = true; state.phase = 'resolve'; state.elapsed = 0;
      } else if (aliveB === 0) {
        state.won = false; state.phase = 'resolve'; state.elapsed = 0;
      } else if (state.elapsed > MAX_BATTLE_TIME) {
        state.won = aliveB > 0;
        if (state.won) for (const e of state.enemies) if (e.state !== 'dead') killEnemy(e, state);
        state.phase = 'resolve'; state.elapsed = 0;
      }
      break;
    }

    case 'resolve': {
      if (state.elapsed >= RESOLVE_DURATION) state.phase = 'done';
      break;
    }
  }

  // Clean FX
  for (let i = state.fx.length - 1; i >= 0; i--) if (state.fx[i].done) state.fx.splice(i, 1);
  return state;
}

// ---- Sub-ticks ----

function tickEnemyMovement(state: BattleState, dt: number, buildings: PlacedBuilding[], ox: number, oy: number) {
  for (const e of state.enemies) {
    if (e.state === 'dead') continue;
    if (e.state === 'walk') {
      const dx = e.targetX - e.x, dy = e.targetY - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TILE_W * 1.2) { e.state = 'attack'; e.attackTimer = 0; }
      else {
        let moveX = (dx / dist) * e.speed * dt;
        let moveY = (dy / dist) * e.speed * dt;

        // Avoid walking through non-target buildings
        const nextX = e.x + moveX;
        const nextY = e.y + moveY;
        for (const b of buildings) {
          if (b.id === e.targetBuildingId) continue;
          if (!['house', 'farm', 'barracks', 'tower', 'wall', 'fountain'].includes(b.type)) continue;
          const bhp = state.buildingHp.get(b.id);
          if (bhp?.destroyed) continue;
          const fp = footprintOf(b.type);
          const bLeft = ox + b.gx * TILE_W - TILE_W * 0.3;
          const bRight = ox + (b.gx + fp.w) * TILE_W + TILE_W * 0.3;
          const bTop = oy + b.gy * TILE_H - TILE_H * 0.3;
          const bBottom = oy + (b.gy + fp.h) * TILE_H + TILE_H * 0.3;
          if (nextX > bLeft && nextX < bRight && nextY > bTop && nextY < bBottom) {
            // Push away from building center
            const bcx = ox + (b.gx + fp.w / 2) * TILE_W;
            const bcy = oy + (b.gy + fp.h / 2) * TILE_H;
            const pushX = e.x - bcx, pushY = e.y - bcy;
            const pushDist = Math.sqrt(pushX * pushX + pushY * pushY) || 1;
            moveX = (pushX / pushDist) * e.speed * dt * 0.8;
            moveY = (pushY / pushDist) * e.speed * dt * 0.8;
            break;
          }
        }
        e.x += moveX; e.y += moveY; e.facingLeft = dx < 0;
      }
    }
    if (e.state === 'attack') {
      e.attackTimer += dt;
      if (e.attackTimer >= ENEMY_ATTACK_INTERVAL && e.targetBuildingId) {
        e.attackTimer = 0;
        const bhp = state.buildingHp.get(e.targetBuildingId);
        if (bhp && !bhp.destroyed) {
          bhp.hp -= ENEMY_DAMAGE;
          state.fx.push({ id: state.nextId++, x: e.targetX + (Math.random() - 0.5) * 30, y: e.targetY - 20 + (Math.random() - 0.5) * 20, type: 'fire', done: false });
          if (bhp.hp <= 0) {
            bhp.hp = 0; bhp.destroyed = true;
            state.fx.push({ id: state.nextId++, x: e.targetX, y: e.targetY - 20, type: 'explosion', done: false });
            state.slowMoTimer = 0.5;
            retarget(e, state, buildings, ox, oy);
          }
        } else { retarget(e, state, buildings, ox, oy); }
      }
    }
  }
}

function tickArchers(state: BattleState, dt: number) {
  for (const a of state.archers) {
    a.shootTimer += dt;
    if (a.shootTimer >= a.shootCooldown) {
      const target = findClosest(state.enemies, a.x, a.y);
      if (target) {
        a.shootTimer = 0; a.state = 'shoot';
        state.arrows.push({
          id: state.nextId++, x: a.x, y: a.y,
          targetX: target.x, targetY: target.y,
          speed: ARROW_SPEED, damage: ARROW_DAMAGE,
          angle: Math.atan2(target.y - a.y, target.x - a.x),
        });
      }
    }
    if (a.state === 'shoot' && a.shootTimer > 0.3) a.state = 'idle';
  }
}

function tickArrows(state: BattleState, dt: number) {
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const a = state.arrows[i];
    const dx = a.targetX - a.x, dy = a.targetY - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 14) {
      for (const e of state.enemies) {
        if (e.state === 'dead') continue;
        if (Math.hypot(e.x - a.targetX, e.y - a.targetY) < TILE_W) {
          e.hp -= a.damage;
          if (e.hp <= 0) killEnemy(e, state);
          break;
        }
      }
      state.arrows.splice(i, 1);
    } else {
      a.x += (dx / dist) * a.speed * dt;
      a.y += (dy / dist) * a.speed * dt;
      a.angle = Math.atan2(dy, dx);
    }
  }
}

function tickDefenders(state: BattleState, dt: number) {
  for (const d of state.defenders) {
    if (d.state === 'dead') continue;
    if (d.state === 'idle') {
      const t = findClosest(state.enemies, d.x, d.y);
      if (t) { d.targetEnemyId = t.id; d.state = 'walk'; }
    }
    if (d.state === 'walk' && d.targetEnemyId !== null) {
      const t = state.enemies.find(e => e.id === d.targetEnemyId);
      if (!t || t.state === 'dead') { d.targetEnemyId = null; d.state = 'idle'; continue; }
      const dx = t.x - d.x, dy = t.y - d.y, dist = Math.sqrt(dx * dx + dy * dy);
      d.facingLeft = dx < 0;
      if (dist < TILE_W * 0.8) { d.state = 'attack'; d.attackTimer = 0; }
      else { d.x += (dx / dist) * d.speed * dt; d.y += (dy / dist) * d.speed * dt; }
    }
    if (d.state === 'attack') {
      const t = state.enemies.find(e => e.id === d.targetEnemyId);
      if (!t || t.state === 'dead') { d.targetEnemyId = null; d.state = 'idle'; continue; }
      d.attackTimer += dt;
      if (d.attackTimer >= d.attackInterval) {
        d.attackTimer = 0; t.hp -= d.damage;
        if (t.hp <= 0) killEnemy(t, state);
      }
      if (Math.hypot(t.x - d.x, t.y - d.y) > TILE_W * 1.5) d.state = 'walk';
    }
  }
}

function tickEnemyVsDefenders(state: BattleState, dt: number) {
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
}

export function isBattleDone(state: BattleState): boolean {
  return state.phase === 'done';
}

/** Check if city has any defense buildings. */
export function hasDefense(buildings: PlacedBuilding[]): boolean {
  return buildings.some(b => b.type === 'barracks' || b.type === 'tower');
}
