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

import type { PveCamp, Difficulty } from '@/lib/pveCamps';
import { DIFFICULTY_MULT } from '@/lib/pveCamps';
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
  damage: number;
  state: 'walk' | 'attack' | 'dead';
  attackTimer: number;
  facingLeft: boolean;
  tier: 'scout' | 'soldier' | 'elite';
  /** Stuck detection: last position + timer. */
  lastX: number; lastY: number; stuckTimer: number;
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
  /** Tower this archer stands on; dies if tower is destroyed. */
  towerId: string;
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
  difficulty: Difficulty;
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

const ENEMY_SPEED = 75;
const ENEMY_ATTACK_INTERVAL = 0.7;
const ENEMY_DAMAGE = 16;
const ATTACK_RANGE = TILE_W * 1.3; // close to building before attacking
const ARROW_SPEED = 350;
const ARROW_DAMAGE = 18;
const ARCHER_COOLDOWN = 1.3;
const HP_PER_LEVEL = 50;
const WALL_HP_BONUS = 25;
const COUNTDOWN_SEC = 2.5;
const WAVE_DELAY = 3.5;
const MAX_TIME = 90;
const RESOLVE_SEC = 2.5;

// ---- Create ----

export function createBattle(
  camp: PveCamp,
  buildings: PlacedBuilding[],
  ox: number, oy: number,
  landEdgeCells: Array<{ gx: number; gy: number }>,
  landSet: Set<string>,
  difficulty: Difficulty = 'easy',
): BattleState {
  const castle = buildings.find(b => b.id === 'castle-main')
               ?? buildings.find(b => b.id === 'start-house')
               ?? buildings.find(b => b.type === 'house');
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
        speed: 90, damage: 12 + b.level * 5,  // was 60 — much faster
        attackTimer: 0, attackInterval: 0.8,
        state: 'idle', targetEnemyId: null, facingLeft: false,
        unitType: b.level >= 6 ? 'lancer' : 'warrior',
      });
    }
  }

  // Archers on towers (die when their tower is destroyed)
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
        towerId: t.id,
      });
    }
  }

  // Waves — 5 waves, elk groter/zwaarder dan vorige. Langere battles.
  const dm = DIFFICULTY_MULT[difficulty];
  const total = Math.round((camp.spriteCount + 14) * dm.enemyCount);
  // Progressive distribution: 10% / 15% / 20% / 25% / 30%
  const w1 = Math.max(3, Math.ceil(total * 0.10));
  const w2 = Math.max(4, Math.ceil(total * 0.15));
  const w3 = Math.max(5, Math.ceil(total * 0.20));
  const w4 = Math.max(6, Math.ceil(total * 0.25));
  const w5 = Math.max(7, total - w1 - w2 - w3 - w4);

  return {
    phase: 'countdown', elapsed: 0, won: null,
    enemies: [], defenders, archers, arrows: [], fx: [],
    buildingHp, nextId, landEdgeCells, landSet,
    countdownNum: 3, timeScale: 1, slowMoTimer: 0,
    castleId, castleHit: false, difficulty,
    damageEvents: [], waveAnnouncement: null, waveAnnouncementTimer: 0,
    currentWave: 0, waveSpawned: [0, 0, 0, 0, 0], waveTotals: [w1, w2, w3, w4, w5], waveTimer: 0,
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
  return landSet.has(`${Math.floor(px / TILE_W)},${Math.floor(py / TILE_H)}`);
}

/** Get alive building rects (filters out destroyed). */
function aliveRects(state: BattleState, skipId?: string): BattleState['buildingRects'] {
  return state.buildingRects.filter(r => {
    if (r.id === skipId) return false;
    const hp = state.buildingHp.get(r.id);
    return hp && !hp.destroyed;
  });
}

/** Check if position collides with any building rect. */
function hitsBuilding(px: number, py: number, rects: BattleState['buildingRects']): boolean {
  const m = TILE_W * 0.6; // generous margin
  for (const r of rects) {
    if (px > r.left - m && px < r.right + m && py > r.top - m && py < r.bottom + m) return true;
  }
  return false;
}

/** Check if a straight line from (x,y) to (x+mx, y+my) crosses a building. */
function lineHitsBuilding(x: number, y: number, mx: number, my: number, rects: BattleState['buildingRects']): boolean {
  // Check 3 points along the path
  for (let t = 0.33; t <= 1; t += 0.33) {
    if (hitsBuilding(x + mx * t, y + my * t, rects)) return true;
  }
  return false;
}

/** Try to move in direction (dx,dy). Avoids buildings and water. */
function steer(
  x: number, y: number, dx: number, dy: number, speed: number, dt: number,
  allRects: BattleState['buildingRects'], landSet: Set<string>, state: BattleState, skipId?: string,
): { mx: number; my: number } {
  const rects = aliveRects(state, skipId);
  const step = speed * dt;
  const s = step; // shorthand

  // 1. Try direct path
  if (!lineHitsBuilding(x, y, dx * s, dy * s, rects) && isLand(x + dx * s, y + dy * s, landSet)) {
    return { mx: dx * s, my: dy * s };
  }

  // 2. Try X-only slide
  if (Math.abs(dx) > 0.01 && !lineHitsBuilding(x, y, dx * s, 0, rects) && isLand(x + dx * s, y, landSet)) {
    return { mx: dx * s, my: 0 };
  }

  // 3. Try Y-only slide
  if (Math.abs(dy) > 0.01 && !lineHitsBuilding(x, y, 0, dy * s, rects) && isLand(x, y + dy * s, landSet)) {
    return { mx: 0, my: dy * s };
  }

  // 4. Try perpendicular (go around the building)
  if (!lineHitsBuilding(x, y, -dy * s, dx * s, rects) && isLand(x - dy * s, y + dx * s, landSet)) {
    return { mx: -dy * s, my: dx * s };
  }
  if (!lineHitsBuilding(x, y, dy * s, -dx * s, rects) && isLand(x + dy * s, y - dx * s, landSet)) {
    return { mx: dy * s, my: -dx * s };
  }

  // 5. Push away from nearest building if stuck inside one
  for (const r of rects) {
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < TILE_W * 3 && d > 1) {
      const px = ((x - cx) / d) * s * 0.6;
      const py = ((y - cy) / d) * s * 0.6;
      if (isLand(x + px, y + py, landSet)) return { mx: px, my: py };
    }
  }

  return { mx: 0, my: 0 };
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
      state.waveAnnouncementTimer = 2.2;
    }
    // Clean FX even during countdown
    for (let i = state.fx.length - 1; i >= 0; i--) if (state.fx[i].done) state.fx.splice(i, 1);
    return state;
  }

  if (state.phase === 'battle') {
    // ---- Spawn waves ----
    state.waveTimer += dt;
    const w = state.currentWave;
    // Tier pattern per wave: versterkt progressief, mix om variatie.
    const WAVE_TIERS: ('scout' | 'soldier' | 'elite')[] = ['scout', 'soldier', 'elite', 'soldier', 'elite'];
    const WAVE_NAMES = ['GOLF 2: SOLDATEN', 'GOLF 3: ELITE', 'GOLF 4: HORDE', 'GOLF 5: BAAS'];
    if (w < 5) {
      const spawned = state.waveSpawned[w];
      const total = state.waveTotals[w];
      if (spawned < total && state.waveTimer > spawned * 0.65) {
        spawn(state, camp, WAVE_TIERS[w], buildings, ox, oy);
        state.waveSpawned[w]++;
      }
      if (spawned >= total) {
        // Next wave when most enemies from this wave are dead
        const currentTier = WAVE_TIERS[w];
        const waveAlive = state.enemies.filter(e => e.tier === currentTier && e.state !== 'dead').length;
        if (waveAlive <= 1 || state.waveTimer > 14) {
          state.currentWave++;
          state.waveTimer = -WAVE_DELAY;
          if (state.currentWave >= 1 && state.currentWave <= 4) {
            state.waveAnnouncement = WAVE_NAMES[state.currentWave - 1];
            state.waveAnnouncementTimer = 2.2;
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
  const alive = [...state.buildingHp.entries()].filter(([, h]) => !h.destroyed)
    .map(([id]) => buildings.find(b => b.id === id)).filter(Boolean) as PlacedBuilding[];
  if (alive.length === 0) return;

  let targetB: PlacedBuilding | undefined;

  // Smart AI: castle is the primary goal. Scouts break defenses first,
  // soldiers mix, elites tunnel straight to the castle.
  const castle = alive.find(b => b.id === state.castleId);
  if (tier === 'scout') {
    // Scouts go for towers/barracks first (clear defense), then castle
    const towers = alive.filter(b => b.type === 'tower');
    const barracks = alive.filter(b => b.type === 'barracks');
    if (towers.length > 0) targetB = towers[Math.floor(Math.random() * towers.length)];
    else if (barracks.length > 0) targetB = barracks[Math.floor(Math.random() * barracks.length)];
    else if (castle) targetB = castle;
  } else if (tier === 'soldier') {
    // Soldiers: 60% castle, 30% towers, 10% other — castle bias
    const r = Math.random();
    if (r < 0.6 && castle) targetB = castle;
    else if (r < 0.9) {
      const towers = alive.filter(b => b.type === 'tower');
      if (towers.length > 0) targetB = towers[Math.floor(Math.random() * towers.length)];
    }
    if (!targetB) targetB = alive[Math.floor(Math.random() * alive.length)];
  } else {
    // Elites: always the castle
    if (castle) targetB = castle;
  }

  if (!targetB) targetB = alive[Math.floor(Math.random() * alive.length)];
  if (!targetB) return;

  const pos = edgePos(ox, oy, state.landEdgeCells);

  // If target is behind a wall, attack the wall first
  if (targetB.type !== 'wall') {
    const walls = alive.filter(b => b.type === 'wall');
    const tc = buildingCenter(targetB, ox, oy);
    for (const wall of walls) {
      const wc = buildingCenter(wall, ox, oy);
      const dToWall = Math.hypot(wc.x - pos.x, wc.y - pos.y);
      const dToTarget = Math.hypot(tc.x - pos.x, tc.y - pos.y);
      if (dToWall < dToTarget * 0.8) {
        targetB = wall;
        break;
      }
    }
  }

  const c = buildingCenter(targetB, ox, oy);
  const diffMult = DIFFICULTY_MULT[state.difficulty];
  const baseHp = (45 + camp.defense * 5) * diffMult.enemyHp;
  // Tier scaling: scouts = glass cannons (fast+fragile), elites = tanks
  const hpMult = tier === 'scout' ? 0.35 : tier === 'soldier' ? 1.0 : 3.5;
  const spdMult = tier === 'scout' ? 1.6 : tier === 'soldier' ? 1.0 : 0.6;
  const dmgMult = tier === 'scout' ? 0.6 : tier === 'soldier' ? 1.0 : 2.2;
  const hp = Math.round(baseHp * hpMult);

  state.enemies.push({
    id: state.nextId++,
    x: pos.x, y: pos.y, targetX: c.x, targetY: c.y,
    targetBuildingId: targetB.id,
    hp, maxHp: hp,
    speed: ENEMY_SPEED * spdMult + Math.random() * 8,
    damage: Math.round(ENEMY_DAMAGE * dmgMult),
    state: 'walk', attackTimer: 0,
    facingLeft: c.x < pos.x, tier,
    lastX: pos.x, lastY: pos.y, stuckTimer: 0,
  });
}

// ---- Sub-ticks ----

function tickEnemies(state: BattleState, dt: number, buildings: PlacedBuilding[], ox: number, oy: number) {
  for (const e of state.enemies) {
    if (e.state === 'dead') continue;

    // Stuck detection: if barely moved in 1.5s, retarget to nearest building
    if (e.state === 'walk') {
      e.stuckTimer += dt;
      if (e.stuckTimer > 1.5) {
        const moved = Math.hypot(e.x - e.lastX, e.y - e.lastY);
        if (moved < TILE_W * 0.5) {
          // Stuck! Find nearest alive building
          let nearestB: PlacedBuilding | null = null, nearD = Infinity;
          for (const [id, hp] of state.buildingHp) {
            if (hp.destroyed) continue;
            const b = buildings.find(bb => bb.id === id);
            if (!b) continue;
            const c = buildingCenter(b, ox, oy);
            const d = Math.hypot(c.x - e.x, c.y - e.y);
            if (d < nearD) { nearD = d; nearestB = b; }
          }
          if (nearestB) {
            const c = buildingCenter(nearestB, ox, oy);
            e.targetBuildingId = nearestB.id;
            e.targetX = c.x; e.targetY = c.y;
          }
        }
        e.lastX = e.x; e.lastY = e.y; e.stuckTimer = 0;
      }
    }

    if (e.state === 'walk') {
      const dx = e.targetX - e.x, dy = e.targetY - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ATTACK_RANGE) {
        e.state = 'attack'; e.attackTimer = 0;
      } else {
        const ndx = dx / dist, ndy = dy / dist;
        const { mx, my } = steer(e.x, e.y, ndx, ndy, e.speed, dt, state.buildingRects, state.landSet, state, e.targetBuildingId);
        e.x += mx; e.y += my;
        // Only update facing if actually moving
        if (Math.abs(mx) > 0.5 || Math.abs(my) > 0.5) {
          e.facingLeft = mx < -0.5;
        }
      }
    }

    if (e.state === 'attack') {
      e.attackTimer += dt;
      if (e.attackTimer >= ENEMY_ATTACK_INTERVAL && e.targetBuildingId) {
        e.attackTimer = 0;
        const bhp = state.buildingHp.get(e.targetBuildingId);
        if (bhp && !bhp.destroyed) {
          bhp.hp -= e.damage;
          emitDmg(state, e.targetX, e.targetY, e.damage, 0xff4444);
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
          d.hp -= e.damage * 0.5 * dt;
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
  // Remove archers whose tower is destroyed
  state.archers = state.archers.filter(a => {
    const hp = state.buildingHp.get(a.towerId);
    return hp && !hp.destroyed;
  });
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
        const { mx, my } = steer(d.x, d.y, dx / dist, dy / dist, d.speed, dt, state.buildingRects, state.landSet, state);
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

/** Pre-battle wave breakdown — gebruikt door AttackClient's pre-battle lobby. */
export function waveBreakdown(camp: PveCamp, difficulty: Difficulty): Array<{ name: string; tier: 'scout' | 'soldier' | 'elite'; count: number }> {
  const dm = DIFFICULTY_MULT[difficulty];
  const total = Math.round((camp.spriteCount + 14) * dm.enemyCount);
  const w1 = Math.max(3, Math.ceil(total * 0.10));
  const w2 = Math.max(4, Math.ceil(total * 0.15));
  const w3 = Math.max(5, Math.ceil(total * 0.20));
  const w4 = Math.max(6, Math.ceil(total * 0.25));
  const w5 = Math.max(7, total - w1 - w2 - w3 - w4);
  return [
    { name: 'Verkenners', tier: 'scout',   count: w1 },
    { name: 'Soldaten',   tier: 'soldier', count: w2 },
    { name: 'Elite',      tier: 'elite',   count: w3 },
    { name: 'Horde',      tier: 'soldier', count: w4 },
    { name: 'Baas',       tier: 'elite',   count: w5 },
  ];
}

export function isBattleDone(state: BattleState): boolean {
  return state.phase === 'done';
}

export function hasDefense(buildings: PlacedBuilding[]): boolean {
  return buildings.some(b => b.type === 'barracks' || b.type === 'tower');
}
