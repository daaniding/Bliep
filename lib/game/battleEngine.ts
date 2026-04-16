/**
 * Island Battle Engine v3 — properly working simulation
 *
 * Core fixes from v2:
 * - Enemies stay on land (elevation check), never cross water
 * - Enemies walk AROUND buildings using steering, not through them
 * - All ticks run every frame regardless of wave state
 * - Attack reach is generous (2 tiles) so enemies actually hit
 * - Castle (start-house) is the lose condition
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
  x: number; y: number;
  state: 'idle' | 'shoot';
  shootTimer: number; shootCooldown: number;
}

export interface BattleArrow {
  id: number;
  x: number; y: number;
  trackEnemyId: number;
  speed: number; damage: number; angle: number;
}

export interface BattleFx {
  id: number;
  x: number; y: number;
  type: 'explosion' | 'fire';
  done: boolean;
}

export interface DamageEvent {
  id: number;
  x: number; y: number;
  amount: number;
  color: number; // hex
}

export interface BuildingHp {
  buildingId: string;
  hp: number; maxHp: number; destroyed: boolean;
}

export type BattlePhase = 'countdown' | 'battle' | 'resolve' | 'done';

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
  /** Set of "gx,gy" strings that are land. */
  landSet: Set<string>;
  countdownNum: number;
  timeScale: number;
  slowMoTimer: number;
  castleId: string | null;
  castleHit: boolean;
  /** Damage events for floating numbers — consumed by renderer each frame. */
  damageEvents: DamageEvent[];
  /** Wave announcement text (set when new wave starts). */
  waveAnnouncement: string | null;
  waveAnnouncementTimer: number;
  // Waves
  currentWave: number;
  waveSpawned: number[];
  waveTotals: number[];
  waveTimer: number;
  /** Occupied building rects for collision. */
  buildingRects: Array<{ left: number; top: number; right: number; bottom: number; id: string }>;
}

// ---- Config ----

const ENEMY_SPEED = 55;
const ENEMY_ATTACK_INTERVAL = 0.8;
const ENEMY_DAMAGE = 15;
const ATTACK_RANGE = TILE_W * 2; // generous so enemies actually reach buildings
const ARROW_SPEED = 320;
const ARROW_DAMAGE = 25;
const ARCHER_COOLDOWN = 1.0;
const HP_PER_LEVEL = 50;
const WALL_HP_BONUS = 25;
const COUNTDOWN_SEC = 2.5;
const WAVE_DELAY = 3.0;
const MAX_TIME = 30;
const RESOLVE_SEC = 2.5;

// ---- Create ----

export function createBattle(
  camp: PveCamp,
  buildings: PlacedBuilding[],
  ox: number, oy: number,
  landEdgeCells: Array<{ gx: number; gy: number }>,
  landSet: Set<string>,
): BattleState {
  const castle = buildings.find(b => b.id === 'start-house') ?? buildings.find(b => b.type === 'house');
  const castleId = castle?.id ?? null;
  const wallBonus = buildings.filter(b => b.type === 'wall').reduce((s, w) => s + w.level, 0) * WALL_HP_BONUS;

  const buildingHp = new Map<string, BuildingHp>();
  for (const b of buildings) {
    if (['house', 'farm', 'barracks', 'wall', 'tower', 'fountain'].includes(b.type)) {
      const maxHp = b.level * HP_PER_LEVEL + wallBonus + (b.id === castleId ? 100 : 0);
      buildingHp.set(b.id, { buildingId: b.id, hp: maxHp, maxHp, destroyed: false });
    }
  }

  // Pre-compute building collision rects
  const buildingRects: BattleState['buildingRects'] = [];
  for (const b of buildings) {
    if (!['house', 'farm', 'barracks', 'wall', 'tower', 'fountain'].includes(b.type)) continue;
    const fp = footprintOf(b.type);
    buildingRects.push({
      left: ox + b.gx * TILE_W,
      top: oy + b.gy * TILE_H,
      right: ox + (b.gx + fp.w) * TILE_W,
      bottom: oy + (b.gy + fp.h) * TILE_H,
      id: b.id,
    });
  }

  // Defenders
  const defenders: BattleDefender[] = [];
  let nextId = 1;
  for (const b of buildings.filter(b => b.type === 'barracks')) {
    const fp = footprintOf('barracks');
    const bx = ox + (b.gx + fp.w / 2) * TILE_W;
    const by = oy + (b.gy + fp.h / 2) * TILE_H;
    const count = Math.min(b.level + 1, 5);
    for (let i = 0; i < count; i++) {
      defenders.push({
        id: nextId++,
        x: bx + (Math.random() - 0.5) * TILE_W, y: by + Math.random() * TILE_H,
        hp: 60 + b.level * 15, maxHp: 60 + b.level * 15,
        speed: 60, damage: 12 + b.level * 5,
        attackTimer: 0, attackInterval: 0.8,
        state: 'idle', targetEnemyId: null, facingLeft: false,
        unitType: b.level >= 6 ? 'lancer' : 'warrior',
      });
    }
  }

  // Archers on towers
  const archers: BattleArcher[] = [];
  for (const t of buildings.filter(b => b.type === 'tower')) {
    const fp = footprintOf('tower');
    const n = Math.min(t.level, 3);
    for (let i = 0; i < n; i++) {
      archers.push({
        id: nextId++,
        x: ox + (t.gx + fp.w / 2) * TILE_W + (i - (n - 1) / 2) * 20,
        y: oy + (t.gy + fp.h * 0.3) * TILE_H,
        state: 'idle', shootTimer: Math.random(),
        shootCooldown: Math.max(0.4, ARCHER_COOLDOWN - t.level * 0.06),
      });
    }
  }

  // Waves
  const total = camp.spriteCount + 3;
  const w1 = Math.max(2, Math.ceil(total * 0.3));
  const w2 = Math.max(2, Math.ceil(total * 0.45));
  const w3 = Math.max(1, total - w1 - w2);

  return {
    phase: 'countdown', elapsed: 0, won: null,
    enemies: [], defenders, archers, arrows: [], fx: [],
    buildingHp, nextId, landEdgeCells, landSet,
    countdownNum: 3, timeScale: 1, slowMoTimer: 0,
    castleId, castleHit: false,
    damageEvents: [], waveAnnouncement: null, waveAnnouncementTimer: 0,
    currentWave: 0, waveSpawned: [0, 0, 0], waveTotals: [w1, w2, w3], waveTimer: 0,
    buildingRects,
  };
}

// ---- Helpers ----

function edgePos(ox: number, oy: number, cells: Array<{ gx: number; gy: number }>): { x: number; y: number } {
  const c = cells[Math.floor(Math.random() * cells.length)];
  return c ? { x: ox + c.gx * TILE_W + TILE_W / 2, y: oy + c.gy * TILE_H + TILE_H / 2 } : { x: ox, y: oy };
}

function closest(enemies: BattleEnemy[], x: number, y: number): BattleEnemy | null {
  let b: BattleEnemy | null = null, bd = Infinity;
  for (const e of enemies) { if (e.state === 'dead') continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; b = e; } }
  return b;
}

function kill(e: BattleEnemy, s: BattleState) {
  e.state = 'dead';
  s.fx.push({ id: s.nextId++, x: e.x, y: e.y - 10, type: 'explosion', done: false });
  s.slowMoTimer = 0.3;
}

function emitDmg(s: BattleState, x: number, y: number, amount: number, color: number) {
  s.damageEvents.push({ id: s.nextId++, x, y: y - 20, amount, color });
}

function buildingCenter(b: PlacedBuilding, ox: number, oy: number) {
  const fp = footprintOf(b.type);
  return { x: ox + (b.gx + fp.w / 2) * TILE_W, y: oy + (b.gy + fp.h / 2) * TILE_H };
}

function retargetToCastle(e: BattleEnemy, s: BattleState, buildings: PlacedBuilding[], ox: number, oy: number) {
  // Try castle first, then any alive building
  const targets = s.castleId && !s.buildingHp.get(s.castleId)?.destroyed
    ? [buildings.find(b => b.id === s.castleId)!]
    : [...s.buildingHp.entries()].filter(([, h]) => !h.destroyed).map(([id]) => buildings.find(b => b.id === id)).filter(Boolean) as PlacedBuilding[];
  if (targets.length === 0) return;
  const t = targets[Math.floor(Math.random() * targets.length)];
  const c = buildingCenter(t, ox, oy);
  e.targetBuildingId = t.id;
  e.targetX = c.x; e.targetY = c.y;
  e.state = 'walk';
}

/** Check if a pixel position is on land. */
function isLand(px: number, py: number, landSet: Set<string>): boolean {
  const gx = Math.floor(px / TILE_W);
  const gy = Math.floor(py / TILE_H);
  return landSet.has(`${gx},${gy}`);
}

/** Steer unit around building rects and keep on land. */
function steer(
  x: number, y: number, dx: number, dy: number, speed: number, dt: number,
  rects: BattleState['buildingRects'], landSet: Set<string>, skipId?: string,
): { mx: number; my: number } {
  let mx = dx * speed * dt;
  let my = dy * speed * dt;
  const nx = x + mx, ny = y + my;
  const pad = TILE_W * 0.4;

  // Building collision — slide along edges
  for (const r of rects) {
    if (r.id === skipId) continue;
    if (nx > r.left - pad && nx < r.right + pad && ny > r.top - pad && ny < r.bottom + pad) {
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      if (Math.abs(x - cx) > Math.abs(y - cy)) {
        mx = 0;
        my = (dy > 0 ? 1 : dy < 0 ? -1 : (Math.random() > 0.5 ? 1 : -1)) * speed * dt;
      } else {
        my = 0;
        mx = (dx > 0 ? 1 : dx < 0 ? -1 : (Math.random() > 0.5 ? 1 : -1)) * speed * dt;
      }
      break;
    }
  }

  // Land check — don't walk into water
  if (!isLand(x + mx, y + my, landSet)) {
    // Try sliding along the coast
    if (isLand(x + mx, y, landSet)) { my = 0; }
    else if (isLand(x, y + my, landSet)) { mx = 0; }
    else { mx = 0; my = 0; } // stuck — don't move into water
  }

  return { mx, my };
}

// ---- Main tick ----

export function tickBattle(
  state: BattleState, rawDt: number,
  buildings: PlacedBuilding[], ox: number, oy: number,
  _bbox: any, camp: PveCamp,
): BattleState {
  // Slow-mo
  if (state.slowMoTimer > 0) { state.slowMoTimer -= rawDt; state.timeScale = 0.3; }
  else state.timeScale = 1;
  const dt = rawDt * state.timeScale;
  state.elapsed += dt;
  state.castleHit = false;

  if (state.phase === 'countdown') {
    state.countdownNum = Math.max(0, 3 - Math.floor(state.elapsed / (COUNTDOWN_SEC / 4)));
    if (state.elapsed >= COUNTDOWN_SEC) {
      state.phase = 'battle'; state.elapsed = 0;
      state.waveAnnouncement = 'GOLF 1: VERKENNERS';
      state.waveAnnouncementTimer = 2.0;
    }
    // Clean FX even during countdown
    for (let i = state.fx.length - 1; i >= 0; i--) if (state.fx[i].done) state.fx.splice(i, 1);
    return state;
  }

  if (state.phase === 'battle') {
    // ---- Spawn waves ----
    state.waveTimer += dt;
    const w = state.currentWave;
    if (w < 3) {
      const spawned = state.waveSpawned[w];
      const total = state.waveTotals[w];
      if (spawned < total && state.waveTimer > spawned * 0.5) {
        const tiers: ('scout' | 'soldier' | 'elite')[] = ['scout', 'soldier', 'elite'];
        spawn(state, camp, tiers[w], buildings, ox, oy);
        state.waveSpawned[w]++;
      }
      if (spawned >= total) {
        // Next wave when most enemies from this wave are dead
        const waveAlive = state.enemies.filter(e => e.tier === (['scout', 'soldier', 'elite'] as const)[w] && e.state !== 'dead').length;
        if (waveAlive <= 1 || state.waveTimer > 10) {
          state.currentWave++;
          state.waveTimer = -WAVE_DELAY;
          const names = ['GOLF 2: LEGER', 'GOLF 3: ELITE'];
          if (state.currentWave <= 2) {
            state.waveAnnouncement = names[state.currentWave - 1];
            state.waveAnnouncementTimer = 2.0;
          }
        }
      }
    }

    // ---- Tick everything ----
    tickEnemies(state, dt, buildings, ox, oy);
    tickArchers(state, dt);
    tickArrows(state, dt);
    tickDefenders(state, dt, buildings, ox, oy);

    // ---- Win/lose ----
    const totalSpawned = state.waveSpawned.reduce((a, b) => a + b, 0);
    const totalPlanned = state.waveTotals.reduce((a, b) => a + b, 0);
    const alive = state.enemies.filter(e => e.state !== 'dead').length;
    const castleHp = state.castleId ? state.buildingHp.get(state.castleId) : null;

    if (castleHp?.destroyed) {
      state.won = false; state.phase = 'resolve'; state.elapsed = 0; state.slowMoTimer = 0.8;
    } else if (alive === 0 && totalSpawned >= totalPlanned) {
      state.won = true; state.phase = 'resolve'; state.elapsed = 0;
    } else if (state.elapsed > MAX_TIME) {
      state.won = !(castleHp?.destroyed);
      state.phase = 'resolve'; state.elapsed = 0;
    }
  }

  if (state.phase === 'resolve') {
    if (state.elapsed >= RESOLVE_SEC) state.phase = 'done';
  }

  // Tick announcement timer
  if (state.waveAnnouncementTimer > 0) {
    state.waveAnnouncementTimer -= rawDt;
    if (state.waveAnnouncementTimer <= 0) state.waveAnnouncement = null;
  }

  for (let i = state.fx.length - 1; i >= 0; i--) if (state.fx[i].done) state.fx.splice(i, 1);
  return state;
}

// ---- Spawn ----

function spawn(state: BattleState, camp: PveCamp, tier: 'scout' | 'soldier' | 'elite', buildings: PlacedBuilding[], ox: number, oy: number) {
  let targetB: PlacedBuilding | undefined;

  if (tier === 'scout') {
    // Scouts target towers first (to disable archers), then random
    const aliveTowers = buildings.filter(b => b.type === 'tower' && !state.buildingHp.get(b.id)?.destroyed);
    if (aliveTowers.length > 0) targetB = aliveTowers[Math.floor(Math.random() * aliveTowers.length)];
  }

  // Soldiers and elites target castle
  if (!targetB) {
    targetB = state.castleId ? buildings.find(b => b.id === state.castleId) : undefined;
  }

  if (!targetB || state.buildingHp.get(targetB.id)?.destroyed) {
    const alive = [...state.buildingHp.entries()].filter(([, h]) => !h.destroyed).map(([id]) => buildings.find(b => b.id === id)).filter(Boolean) as PlacedBuilding[];
    targetB = alive[Math.floor(Math.random() * alive.length)];
  }
  if (!targetB) return;

  const pos = edgePos(ox, oy, state.landEdgeCells);
  const c = buildingCenter(targetB, ox, oy);
  const baseHp = 30 + camp.defense * 3;
  const mult = tier === 'scout' ? 0.5 : tier === 'soldier' ? 1.0 : 2.5;
  const spdMult = tier === 'scout' ? 1.2 : tier === 'soldier' ? 1.0 : 0.6;
  const hp = Math.round(baseHp * mult);

  state.enemies.push({
    id: state.nextId++,
    x: pos.x, y: pos.y, targetX: c.x, targetY: c.y,
    targetBuildingId: targetB.id,
    hp, maxHp: hp,
    speed: ENEMY_SPEED * spdMult + Math.random() * 8,
    state: 'walk', attackTimer: 0,
    facingLeft: c.x < pos.x, tier,
  });
}

// ---- Sub-ticks ----

function tickEnemies(state: BattleState, dt: number, buildings: PlacedBuilding[], ox: number, oy: number) {
  for (const e of state.enemies) {
    if (e.state === 'dead') continue;

    if (e.state === 'walk') {
      // Check if wall is in our path and retarget to it
      const targetB = buildings.find(b => b.id === e.targetBuildingId);
      if (targetB && targetB.type !== 'wall') {
        for (const r of state.buildingRects) {
          if (r.id === e.targetBuildingId) continue;
          const wb = buildings.find(b => b.id === r.id);
          if (!wb || wb.type !== 'wall') continue;
          if (state.buildingHp.get(r.id)?.destroyed) continue;
          // Is this wall between us and target?
          const wallCx = (r.left + r.right) / 2, wallCy = (r.top + r.bottom) / 2;
          const distToWall = Math.hypot(wallCx - e.x, wallCy - e.y);
          const distToTarget = Math.hypot(e.targetX - e.x, e.targetY - e.y);
          if (distToWall < distToTarget && distToWall < TILE_W * 4) {
            e.targetBuildingId = wb.id;
            e.targetX = wallCx; e.targetY = wallCy;
            break;
          }
        }
      }

      const dx = e.targetX - e.x, dy = e.targetY - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ATTACK_RANGE) {
        e.state = 'attack'; e.attackTimer = 0;
      } else {
        const ndx = dx / dist, ndy = dy / dist;
        const { mx, my } = steer(e.x, e.y, ndx, ndy, e.speed, dt, state.buildingRects, state.landSet, e.targetBuildingId);
        e.x += mx; e.y += my;
        e.facingLeft = mx < 0;
      }
    }

    if (e.state === 'attack') {
      e.attackTimer += dt;
      if (e.attackTimer >= ENEMY_ATTACK_INTERVAL && e.targetBuildingId) {
        e.attackTimer = 0;
        const bhp = state.buildingHp.get(e.targetBuildingId);
        if (bhp && !bhp.destroyed) {
          bhp.hp -= ENEMY_DAMAGE;
          emitDmg(state, e.targetX, e.targetY, ENEMY_DAMAGE, 0xff4444);
          if (e.targetBuildingId === state.castleId) state.castleHit = true;
          state.fx.push({ id: state.nextId++, x: e.targetX + (Math.random() - 0.5) * 40, y: e.targetY - 15 + (Math.random() - 0.5) * 20, type: 'fire', done: false });
          if (bhp.hp <= 0) {
            bhp.hp = 0; bhp.destroyed = true;
            state.fx.push({ id: state.nextId++, x: e.targetX, y: e.targetY - 20, type: 'explosion', done: false });
            state.slowMoTimer = 0.5;
            retargetToCastle(e, state, buildings, ox, oy);
          }
        } else {
          retargetToCastle(e, state, buildings, ox, oy);
        }
      }

      // Also fight nearby defenders
      for (const d of state.defenders) {
        if (d.state === 'dead') continue;
        if (Math.hypot(d.x - e.x, d.y - e.y) < TILE_W * 1.5) {
          d.hp -= ENEMY_DAMAGE * 0.5 * dt;
          e.facingLeft = d.x < e.x;
          if (d.hp <= 0) {
            d.state = 'dead';
            state.fx.push({ id: state.nextId++, x: d.x, y: d.y - 10, type: 'explosion', done: false });
          }
        }
      }
    }
  }
}

function tickArchers(state: BattleState, dt: number) {
  for (const a of state.archers) {
    a.shootTimer += dt;
    if (a.shootTimer >= a.shootCooldown) {
      const t = closest(state.enemies, a.x, a.y);
      if (t) {
        a.shootTimer = 0; a.state = 'shoot';
        state.arrows.push({
          id: state.nextId++, x: a.x, y: a.y,
          trackEnemyId: t.id,
          speed: ARROW_SPEED, damage: ARROW_DAMAGE,
          angle: Math.atan2(t.y - a.y, t.x - a.x),
        });
      }
    }
    if (a.state === 'shoot' && a.shootTimer > 0.25) a.state = 'idle';
  }
}

function tickArrows(state: BattleState, dt: number) {
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const a = state.arrows[i];
    const tracked = state.enemies.find(e => e.id === a.trackEnemyId);
    if (!tracked || tracked.state === 'dead') { state.arrows.splice(i, 1); continue; }

    // Home toward target
    const dx = tracked.x - a.x, dy = tracked.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) {
      tracked.hp -= a.damage;
      emitDmg(state, tracked.x, tracked.y, a.damage, 0x44aaff);
      state.fx.push({ id: state.nextId++, x: tracked.x, y: tracked.y - 5, type: 'explosion', done: false });
      if (tracked.hp <= 0) kill(tracked, state);
      state.arrows.splice(i, 1);
    } else {
      a.x += (dx / dist) * a.speed * dt;
      a.y += (dy / dist) * a.speed * dt;
      a.angle = Math.atan2(dy, dx);
    }
  }
}

function tickDefenders(state: BattleState, dt: number, buildings: PlacedBuilding[], ox: number, oy: number) {
  for (const d of state.defenders) {
    if (d.state === 'dead') continue;

    if (d.state === 'idle') {
      const t = closest(state.enemies, d.x, d.y);
      if (t) { d.targetEnemyId = t.id; d.state = 'walk'; }
    }

    if (d.state === 'walk') {
      const t = d.targetEnemyId !== null ? state.enemies.find(e => e.id === d.targetEnemyId) : null;
      if (!t || t.state === 'dead') { d.targetEnemyId = null; d.state = 'idle'; continue; }
      const dx = t.x - d.x, dy = t.y - d.y, dist = Math.hypot(dx, dy);
      d.facingLeft = dx < 0;
      if (dist < TILE_W * 0.9) { d.state = 'attack'; d.attackTimer = 0; }
      else {
        const { mx, my } = steer(d.x, d.y, dx / dist, dy / dist, d.speed, dt, state.buildingRects, state.landSet);
        d.x += mx; d.y += my;
      }
    }

    if (d.state === 'attack') {
      const t = d.targetEnemyId !== null ? state.enemies.find(e => e.id === d.targetEnemyId) : null;
      if (!t || t.state === 'dead') { d.targetEnemyId = null; d.state = 'idle'; continue; }
      d.attackTimer += dt;
      if (d.attackTimer >= d.attackInterval) {
        d.attackTimer = 0;
        t.hp -= d.damage;
        emitDmg(state, t.x, t.y, d.damage, 0x44ff44);
        if (t.hp <= 0) kill(t, state);
      }
      d.facingLeft = t.x < d.x;
      if (Math.hypot(t.x - d.x, t.y - d.y) > TILE_W * 2) d.state = 'walk';
    }
  }
}

export function isBattleDone(state: BattleState): boolean {
  return state.phase === 'done';
}

export function hasDefense(buildings: PlacedBuilding[]): boolean {
  return buildings.some(b => b.type === 'barracks' || b.type === 'tower');
}
