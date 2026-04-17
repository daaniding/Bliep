/**
 * Island generation — distance-field based with organic coastline.
 *
 * Grid values:
 *   0 = deep water
 *   1 = shallow water (near coast)
 *   2 = cliff/coast (rocky border, 2-3 tiles wide)
 *   3 = grass (buildable land)
 *   4 = lake water
 */

export const MAP_COLS = 120;
export const MAP_ROWS = 90;

// ---- Seeded noise helpers ----

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function makeNoise2D(seed: number) {
  const rng = seededRng(seed);
  const grid = new Map<string, number>();
  const lattice = (ix: number, iy: number): number => {
    const key = `${ix},${iy}`;
    let v = grid.get(key);
    if (v === undefined) { v = rng(); grid.set(key, v); }
    return v;
  };
  return (x: number, y: number): number => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = lattice(ix, iy), n10 = lattice(ix + 1, iy);
    const n01 = lattice(ix, iy + 1), n11 = lattice(ix + 1, iy + 1);
    return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy)
         + n01 * (1 - sx) * sy + n11 * sx * sy;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let value = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / total;
}

// ================================================================
// ISLAND GENERATION
// ================================================================

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise1 = makeNoise2D(42);
  const noise2 = makeNoise2D(137);
  const noise3 = makeNoise2D(2891);
  const noise4 = makeNoise2D(7723);

  const centerX = MAP_COLS / 2;
  const centerY = MAP_ROWS / 2;
  const radiusX = MAP_COLS * 0.36;
  const radiusY = MAP_ROWS * 0.36;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const dx = (c - centerX) / radiusX;
      const dy = (r - centerY) / radiusY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const n1 = fbm(noise1, c * 0.025, r * 0.025, 4) * 0.40;
      const n2 = fbm(noise2, c * 0.06, r * 0.06, 3) * 0.22;
      const n3 = fbm(noise3, c * 0.12, r * 0.12, 2) * 0.12;

      const angle = Math.atan2(r - centerY, c - centerX);
      const peninsulaNoise = fbm(noise4, angle * 2.5 + 10, dist * 3, 3);
      const peninsulaBonus = peninsulaNoise * 0.18 * Math.max(0, dist - 0.4);

      const value = dist + n1 + n2 + n3 - peninsulaBonus;

      if (value < 0.88) {
        grid[r][c] = 3; // grass
      }
    }
  }

  // Remove tiny islands (< 8 cells)
  const visited = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 3 || visited[r][c]) continue;
      const component: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visited[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        component.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
          if (grid[nr][nc] !== 3 || visited[nr][nc]) continue;
          visited[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (component.length < 8) {
        for (const [cr, cc] of component) grid[cr][cc] = 0;
      }
    }
  }

  // Fill tiny water holes (< 6 cells)
  const visitedW = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 0 || visitedW[r][c]) continue;
      const component: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visitedW[r][c] = true;
      let touchesEdge = false;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        component.push([cr, cc]);
        if (cr === 0 || cr === MAP_ROWS - 1 || cc === 0 || cc === MAP_COLS - 1) touchesEdge = true;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) { touchesEdge = true; continue; }
          if (grid[nr][nc] !== 0 || visitedW[nr][nc]) continue;
          visitedW[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (!touchesEdge && component.length < 6) {
        for (const [cr, cc] of component) grid[cr][cc] = 3;
      }
    }
  }

  return grid;
}

// ================================================================
// POST-PROCESSING
// ================================================================

export function processElevation(raw: number[][]): number[][] {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const grid: number[][] = raw.map(r => [...r]);

  // ---- Cliff band: grass cells within 2 tiles of water → cliff (2) ----
  // This creates the thick rocky coast edge seen in the reference images
  const distToWater: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(999)
  );
  // BFS from water cells
  const wQueue: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) { distToWater[r][c] = 0; wQueue.push([r, c]); }
    }
  }
  let wqi = 0;
  while (wqi < wQueue.length) {
    const [r, c] = wQueue[wqi++];
    const d = distToWater[r][c];
    if (d >= 5) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (distToWater[nr][nc] <= d + 1) continue;
      distToWater[nr][nc] = d + 1;
      wQueue.push([nr, nc]);
    }
  }
  // Convert grass within 2 tiles of water to cliff
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 3 && distToWater[r][c] <= 2) {
        grid[r][c] = 2; // cliff
      }
    }
  }

  // ---- Shallow water: ocean cells within 3 tiles of land ----
  const distToLand: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(999)
  );
  const queue: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] >= 2) { distToLand[r][c] = 0; queue.push([r, c]); }
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    const d = distToLand[r][c];
    if (d >= 4) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (distToLand[nr][nc] <= d + 1) continue;
      distToLand[nr][nc] = d + 1;
      queue.push([nr, nc]);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0 && distToLand[r][c] <= 3) {
        grid[r][c] = 1; // shallow water
      }
    }
  }

  // ---- Lake — small round blob in the northeast ----
  const lakeNoise = makeNoise2D(1337);
  const lakeCX = 72, lakeCY = 26;
  const lakeR = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 3) continue;
      const dx = (c - lakeCX) / lakeR;
      const dy = (r - lakeCY) / lakeR;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(lakeNoise, c * 0.1, r * 0.1, 2) * 0.2;
      if (dist + n < 0.85) {
        grid[r][c] = 4; // lake
      }
    }
  }
  // Lake shore: grass around lake within 1 tile → cliff for rocky edge
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 3) continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (grid[r + dr]?.[c + dc] === 4) {
          grid[r][c] = 2; // cliff around lake
          break;
        }
      }
    }
  }

  return grid;
}
