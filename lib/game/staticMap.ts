/**
 * Island generation — hand-designed shape with organic coastline.
 *
 * Instead of pure noise, the island is built from overlapping shapes
 * (circles, ellipses) that create an intentional landmass with
 * bays, peninsulas, and a harbor area. Noise is added on top for
 * organic coastline detail.
 *
 * Grid values:
 *   0 = deep water
 *   1 = shallow water (near coast)
 *   3 = grass (land)
 *   4 = lake water
 */

export const MAP_COLS = 120;
export const MAP_ROWS = 90;

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

/** Smooth distance to an ellipse (0 = center, 1 = edge). */
function ellipseDist(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise1 = makeNoise2D(42);
  const noise2 = makeNoise2D(137);
  const noise3 = makeNoise2D(2891);

  // ================================================================
  // ISLAND SHAPE — built from overlapping shapes
  // Think: main body + southern bay + eastern peninsula + northern bump
  // ================================================================

  const cx = MAP_COLS / 2;  // 60
  const cy = MAP_ROWS / 2;  // 45

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // --- Main body: wide ellipse, slightly left of center ---
      const mainDist = ellipseDist(c, r, cx - 3, cy, 32, 26);

      // --- Southern peninsula pointing SE ---
      const southPenDist = ellipseDist(c, r, cx + 15, cy + 20, 18, 12);

      // --- Northern lobe (wider top) ---
      const northLobeDist = ellipseDist(c, r, cx + 5, cy - 16, 22, 14);

      // --- Western bump ---
      const westBumpDist = ellipseDist(c, r, cx - 22, cy - 5, 14, 18);

      // --- Small eastern peninsula ---
      const eastPenDist = ellipseDist(c, r, cx + 28, cy + 5, 10, 8);

      // --- Harbor bay (subtract — creates an inlet on the south) ---
      const bayDist = ellipseDist(c, r, cx - 5, cy + 22, 12, 10);

      // --- NE cove (subtract — creates a cove) ---
      const coveDist = ellipseDist(c, r, cx + 18, cy - 18, 8, 7);

      // Combine: land if ANY shape is close enough (union of shapes)
      const minLand = Math.min(mainDist, southPenDist, northLobeDist, westBumpDist, eastPenDist);

      // Noise for organic coastline (not too much — shape should be recognizable)
      const n1 = fbm(noise1, c * 0.03, r * 0.03, 4) * 0.25;
      const n2 = fbm(noise2, c * 0.08, r * 0.08, 3) * 0.12;
      const n3 = fbm(noise3, c * 0.15, r * 0.15, 2) * 0.06;

      const landValue = minLand + n1 + n2 + n3;
      const threshold = 0.92;

      if (landValue < threshold) {
        // Check if inside a bay/cove (subtract)
        const bayStrength = Math.max(0, 1 - bayDist) * 0.8;
        const coveStrength = Math.max(0, 1 - coveDist) * 0.7;

        if (landValue + bayStrength * 0.6 < threshold && bayDist > 0.5) {
          grid[r][c] = 3; // land
        } else if (bayDist > 0.5 && coveDist > 0.5) {
          grid[r][c] = 3; // land (not in bay or cove)
        } else if (landValue < threshold * 0.7) {
          grid[r][c] = 3; // deep enough inside to survive bay subtraction
        }
      }
    }
  }

  // ---- Remove tiny islands (< 10 cells) ----
  const visited = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 3 || visited[r][c]) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visited[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        comp.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
          if (grid[nr][nc] !== 3 || visited[nr][nc]) continue;
          visited[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (comp.length < 10) comp.forEach(([cr, cc]) => { grid[cr][cc] = 0; });
    }
  }

  // ---- Fill tiny water holes inside the island (< 8 cells) ----
  const visitedW = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 0 || visitedW[r][c]) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visitedW[r][c] = true;
      let touchesEdge = false;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        comp.push([cr, cc]);
        if (cr === 0 || cr === MAP_ROWS - 1 || cc === 0 || cc === MAP_COLS - 1) touchesEdge = true;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) { touchesEdge = true; continue; }
          if (grid[nr][nc] !== 0 || visitedW[nr][nc]) continue;
          visitedW[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (!touchesEdge && comp.length < 8) comp.forEach(([cr, cc]) => { grid[cr][cc] = 3; });
    }
  }

  return grid;
}

export function processElevation(raw: number[][]): number[][] {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const grid: number[][] = raw.map(r => [...r]);

  // Shallow water: ocean cells within 3 tiles of land
  const distToLand: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(999));
  const queue: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 3) { distToLand[r][c] = 0; queue.push([r, c]); }
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
      if (grid[r][c] === 0 && distToLand[r][c] <= 3) grid[r][c] = 1;
    }
  }

  // Lake uitgeschakeld — komt later als aparte layer

  return grid;
}
