#!/usr/bin/env node
/**
 * Generates a Tiled-compatible .tmj (JSON) map file for the Bliep island.
 *
 * The map uses the farm_spring_summer.png tileset (75×45 tiles at 16px).
 * Output: public/island.tmj — open in Tiled, tweak, re-export.
 *
 * Usage: node scripts/generate-tiled-map.mjs
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Tileset constants ----
const TILESET_COLS = 75; // 1200 / 16
const TILESET_ROWS = 45; // 720 / 16
const TILE_SIZE = 16;

// Tiled GID: 1-indexed, left-to-right, top-to-bottom. 0 = empty.
const gid = (col, row) => row * TILESET_COLS + col + 1;

// ---- Known tile positions from farmTerrain.ts ----
const TILES = {
  // Water
  water: gid(0, 21),

  // Coast 3×3 (cliff edge): cols 1-3, rows 22-24
  // NW  N  NE
  // W   C  E
  // SW  S  SE
  coastNW: gid(1, 22), coastN: gid(2, 22), coastNE: gid(3, 22),
  coastW:  gid(1, 23), coastC: gid(2, 23), coastE:  gid(3, 23),
  coastSW: gid(1, 24), coastS: gid(2, 24), coastSE: gid(3, 24),

  // Coast inner corners
  coastInnerNW: gid(5, 21), coastInnerNE: gid(8, 21),
  coastInnerSW: gid(5, 24), coastInnerSE: gid(8, 24),

  // Grass variants
  grass1: gid(19, 1),
  grass2: gid(20, 1),
  grass3: gid(21, 1),
  grass4: gid(20, 0),

  // Sand/path fill
  sandFill: gid(16, 37),

  // Sand-to-grass 3×3 transition: cols 15-17, rows 36-38
  stgNW: gid(15, 36), stgN: gid(16, 36), stgNE: gid(17, 36),
  stgW:  gid(15, 37), stgC: gid(16, 37), stgE:  gid(17, 37),
  stgSW: gid(15, 38), stgS: gid(16, 38), stgSE: gid(17, 38),

  // Flowers
  flowerWhite1: gid(21, 4), flowerWhite2: gid(22, 4), flowerWhite3: gid(23, 4),
  flowerPurple1: gid(24, 4), flowerPurple2: gid(25, 4),

  // Grass tufts
  tuft1: gid(21, 2), tuft2: gid(22, 2), tuft3: gid(23, 2),
  tuft4: gid(24, 2), tuft5: gid(25, 2),

  // Mushrooms
  mush1: gid(13, 5), mush2: gid(14, 5), mush3: gid(15, 5),

  // Cattails
  cattail1: gid(19, 5), cattail2: gid(20, 5),
  cattail3: gid(19, 4), cattail4: gid(20, 4),

  // Stone path
  stone1: gid(18, 9), stone2: gid(18, 13),
};

// ---- Map dimensions ----
const MAP_W = 70;
const MAP_H = 50;

// ---- Seeded random ----
let _seed = 42;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) | 0;
  return ((_seed >>> 0) % 10000) / 10000;
}

// ---- Noise helpers ----
const noiseCache = new Map();
function noise2D(x, y, seed = 100) {
  const key = `${Math.floor(x)},${Math.floor(y)},${seed}`;
  if (noiseCache.has(key)) return noiseCache.get(key);
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  const v = ((h >>> 0) % 10000) / 10000;
  noiseCache.set(key, v);
  return v;
}

function smoothNoise(x, y, freq = 0.08, seed = 100) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const n00 = noise2D(ix, iy, seed), n10 = noise2D(ix + 1, iy, seed);
  const n01 = noise2D(ix, iy + 1, seed), n11 = noise2D(ix + 1, iy + 1, seed);
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy;
}

function fbm(x, y, octaves = 4, seed = 100) {
  let value = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x, y, 0.06 * freq, seed + i * 1000) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / total;
}

// ---- Generate island shape ----
// elevation: 0=water, 1=shallow, 2=cliff, 3=grass, 4=lake
const elevation = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(0));

const cx = MAP_W / 2;
const cy = MAP_H / 2;
const rx = MAP_W * 0.38;
const ry = MAP_H * 0.38;

// Step 1: Generate land
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    const dx = (c - cx) / rx;
    const dy = (r - cy) / ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const n1 = fbm(c, r, 4, 42) * 0.38;
    const n2 = fbm(c, r, 3, 137) * 0.20;
    const angle = Math.atan2(r - cy, c - cx);
    const pen = fbm(angle * 2.5 + 10, dist * 3, 3, 7723) * 0.16 * Math.max(0, dist - 0.4);
    if (dist + n1 + n2 - pen < 0.88) {
      elevation[r][c] = 3;
    }
  }
}

// Step 2: Remove tiny islands
const visited = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 3 || visited[r][c]) continue;
    const comp = [];
    const stack = [[r, c]];
    visited[r][c] = true;
    while (stack.length) {
      const [cr, cc] = stack.pop();
      comp.push([cr, cc]);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= MAP_H || nc < 0 || nc >= MAP_W) continue;
        if (elevation[nr][nc] !== 3 || visited[nr][nc]) continue;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    if (comp.length < 6) comp.forEach(([cr, cc]) => { elevation[cr][cc] = 0; });
  }
}

// Step 3: Cliff band (2 tiles from water)
const distToWater = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(999));
const wq = [];
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] === 0) { distToWater[r][c] = 0; wq.push([r, c]); }
  }
}
let wi = 0;
while (wi < wq.length) {
  const [r, c] = wq[wi++];
  const d = distToWater[r][c];
  if (d >= 5) continue;
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= MAP_H || nc < 0 || nc >= MAP_W) continue;
    if (distToWater[nr][nc] <= d + 1) continue;
    distToWater[nr][nc] = d + 1;
    wq.push([nr, nc]);
  }
}
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] === 3 && distToWater[r][c] <= 2) {
      elevation[r][c] = 2; // cliff
    }
  }
}

// Step 4: Shallow water
const distToLand = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(999));
const lq = [];
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] >= 2) { distToLand[r][c] = 0; lq.push([r, c]); }
  }
}
let li = 0;
while (li < lq.length) {
  const [r, c] = lq[li++];
  const d = distToLand[r][c];
  if (d >= 4) continue;
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= MAP_H || nc < 0 || nc >= MAP_W) continue;
    if (distToLand[nr][nc] <= d + 1) continue;
    distToLand[nr][nc] = d + 1;
    lq.push([nr, nc]);
  }
}
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] === 0 && distToLand[r][c] <= 2) elevation[r][c] = 1;
  }
}

// Step 5: Small lake
const lakeCX = Math.round(MAP_W * 0.65), lakeCY = Math.round(MAP_H * 0.35);
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 3) continue;
    const dx = (c - lakeCX) / 3.5;
    const dy = (r - lakeCY) / 3;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist + smoothNoise(c, r, 0.15, 1337) * 0.25 < 0.85) {
      elevation[r][c] = 4;
    }
  }
}
// Lake shore → cliff
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 3) continue;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      if (elevation[r+dr]?.[c+dc] === 4) { elevation[r][c] = 2; break; }
    }
  }
}

// ---- Helper: get cell safely ----
const get = (r, c) => elevation[r]?.[c] ?? 0;
const isWater = (v) => v === 0 || v === 1 || v === 4;

// ---- Build tile layers ----
function makeLayer(name, data) {
  return {
    id: 0, // Tiled assigns IDs
    name,
    type: 'tilelayer',
    width: MAP_W,
    height: MAP_H,
    x: 0, y: 0,
    opacity: 1,
    visible: true,
    data,
  };
}

// Layer 1: Water (fill everything with water tile)
const waterData = new Array(MAP_W * MAP_H).fill(TILES.water);

// Layer 2: Cliff/coast autotile
const cliffData = new Array(MAP_W * MAP_H).fill(0);
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 2) continue;
    const n = get(r - 1, c), s = get(r + 1, c), w = get(r, c - 1), e = get(r, c + 1);
    const wN = isWater(n), wS = isWater(s), wW = isWater(w), wE = isWater(e);

    let tile;
    if (wN && wW) tile = TILES.coastNW;
    else if (wN && wE) tile = TILES.coastNE;
    else if (wS && wW) tile = TILES.coastSW;
    else if (wS && wE) tile = TILES.coastSE;
    else if (wN) tile = TILES.coastN;
    else if (wS) tile = TILES.coastS;
    else if (wW) tile = TILES.coastW;
    else if (wE) tile = TILES.coastE;
    else {
      // Inner corners: check diagonals
      const nw = get(r-1, c-1), ne = get(r-1, c+1), sw = get(r+1, c-1), se = get(r+1, c+1);
      if (isWater(nw)) tile = TILES.coastInnerNW;
      else if (isWater(ne)) tile = TILES.coastInnerNE;
      else if (isWater(sw)) tile = TILES.coastInnerSW;
      else if (isWater(se)) tile = TILES.coastInnerSE;
      else tile = TILES.coastC; // fully interior cliff
    }
    cliffData[r * MAP_W + c] = tile;
  }
}

// Layer 3: Grass with variation
const grassData = new Array(MAP_W * MAP_H).fill(0);
const grassTiles = [TILES.grass1, TILES.grass2, TILES.grass3, TILES.grass4];
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 3) continue;

    // Check if bordering cliff for sand-to-grass transition
    const n = get(r-1, c), s = get(r+1, c), w = get(r, c-1), e = get(r, c+1);
    const edgeN = n !== 3, edgeS = s !== 3, edgeW = w !== 3, edgeE = e !== 3;

    if (edgeN || edgeS || edgeW || edgeE) {
      // Sand-to-grass edge tile
      let slotX = 1, slotY = 1;
      if (edgeW) slotX = 0;
      if (edgeE) slotX = 2;
      if (edgeN) slotY = 0;
      if (edgeS) slotY = 2;
      const stgTiles = [
        [TILES.stgNW, TILES.stgN, TILES.stgNE],
        [TILES.stgW, TILES.stgC, TILES.stgE],
        [TILES.stgSW, TILES.stgS, TILES.stgSE],
      ];
      grassData[r * MAP_W + c] = stgTiles[slotY][slotX];
    } else {
      // Random grass variant
      const v = noise2D(c, r, 50);
      grassData[r * MAP_W + c] = grassTiles[Math.floor(v * grassTiles.length)];
    }
  }
}

// Layer 4: Decorations (flowers, tufts, mushrooms)
const decorData = new Array(MAP_W * MAP_H).fill(0);
_seed = 12345;
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 3) continue;
    // Don't decorate edge grass
    const n = get(r-1, c), s = get(r+1, c), w = get(r, c-1), e = get(r, c+1);
    if (n !== 3 || s !== 3 || w !== 3 || e !== 3) continue;

    const rv = rand();
    if (rv < 0.06) {
      // White flowers
      const flowers = [TILES.flowerWhite1, TILES.flowerWhite2, TILES.flowerWhite3];
      decorData[r * MAP_W + c] = flowers[Math.floor(rand() * flowers.length)];
    } else if (rv < 0.09) {
      // Purple flowers
      const flowers = [TILES.flowerPurple1, TILES.flowerPurple2];
      decorData[r * MAP_W + c] = flowers[Math.floor(rand() * flowers.length)];
    } else if (rv < 0.18) {
      // Grass tufts
      const tufts = [TILES.tuft1, TILES.tuft2, TILES.tuft3, TILES.tuft4, TILES.tuft5];
      decorData[r * MAP_W + c] = tufts[Math.floor(rand() * tufts.length)];
    } else if (rv < 0.20) {
      // Mushrooms (further from center)
      const cd = Math.hypot(c - cx, r - cy);
      if (cd > 10) {
        const mush = [TILES.mush1, TILES.mush2, TILES.mush3];
        decorData[r * MAP_W + c] = mush[Math.floor(rand() * mush.length)];
      }
    }
  }
}

// Layer 5: Cattails on cliff cells touching water
const cattailData = new Array(MAP_W * MAP_H).fill(0);
_seed = 99999;
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    if (elevation[r][c] !== 2) continue;
    const n = get(r-1, c), s = get(r+1, c), w = get(r, c-1), e = get(r, c+1);
    if (!(isWater(n) || isWater(s) || isWater(w) || isWater(e))) continue;
    if (rand() > 0.3) continue;
    const cattails = [TILES.cattail1, TILES.cattail2, TILES.cattail3, TILES.cattail4];
    cattailData[r * MAP_W + c] = cattails[Math.floor(rand() * cattails.length)];
  }
}

// ---- Assemble Tiled JSON ----
const tiledMap = {
  compressionlevel: -1,
  height: MAP_H,
  width: MAP_W,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tileheight: TILE_SIZE,
  tilewidth: TILE_SIZE,
  tiledversion: '1.10.2',
  type: 'map',
  version: '1.10',
  nextlayerid: 6,
  nextobjectid: 1,
  layers: [
    { ...makeLayer('water', waterData), id: 1 },
    { ...makeLayer('cliff', cliffData), id: 2 },
    { ...makeLayer('grass', grassData), id: 3 },
    { ...makeLayer('decor', decorData), id: 4 },
    { ...makeLayer('cattails', cattailData), id: 5 },
  ],
  tilesets: [
    {
      columns: TILESET_COLS,
      firstgid: 1,
      image: '../public/assets/farm/tilesets/farm_spring_summer.png',
      imageheight: TILESET_ROWS * TILE_SIZE,
      imagewidth: TILESET_COLS * TILE_SIZE,
      margin: 0,
      name: 'farm_spring_summer',
      spacing: 0,
      tilecount: TILESET_COLS * TILESET_ROWS,
      tileheight: TILE_SIZE,
      tilewidth: TILE_SIZE,
    },
  ],
};

const outPath = join(__dirname, '..', 'public', 'island.tmj');
writeFileSync(outPath, JSON.stringify(tiledMap, null, 2));
console.log(`Generated: ${outPath}`);
console.log(`Map size: ${MAP_W}×${MAP_H} tiles (${MAP_W * TILE_SIZE}×${MAP_H * TILE_SIZE}px)`);
console.log(`Layers: water, cliff, grass, decor, cattails`);
console.log(`\nOpen in Tiled: File → Open → ${outPath}`);
console.log(`After editing, export: File → Save (or Export As .tmj)`);
