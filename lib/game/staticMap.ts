/**
 * Island shape — simple, natural, no gimmicks.
 *
 * Grid values:
 *   0 = deep water
 *   1 = shallow water (near coast)
 *   3 = grass (land)
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

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise = makeNoise2D(77);
  const noise2 = makeNoise2D(333);

  const cx = MAP_COLS / 2;
  const cy = MAP_ROWS / 2;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // Cayo Perico stijl: gebogen langwerpig eiland
      // Curved spine van linksboven naar rechtsonder
      // met variërende breedte langs de lengte

      // Punt op de spine (parametrisch, t=0 linksboven, t=1 rechtsonder)
      // Spine is een gebogen lijn
      const spineX0 = cx - 30, spineY0 = cy - 18;
      const spineX1 = cx + 5,  spineY1 = cy - 5;  // midpoint (buigt naar rechts)
      const spineX2 = cx + 28, spineY2 = cy + 20;

      // Vind dichtstbijzijnde punt op de quadratic bezier spine
      let minDistToSpine = 999;
      let bestT = 0;
      for (let ti = 0; ti <= 40; ti++) {
        const t = ti / 40;
        const it = 1 - t;
        const sx = it * it * spineX0 + 2 * it * t * spineX1 + t * t * spineX2;
        const sy = it * it * spineY0 + 2 * it * t * spineY1 + t * t * spineY2;
        const d = Math.hypot(c - sx, r - sy);
        if (d < minDistToSpine) { minDistToSpine = d; bestT = t; }
      }

      // Breedte varieert langs de spine: dik in het midden, dunner aan de uiteinden
      const widthAtT = 14 + Math.sin(bestT * Math.PI) * 10; // 14-24 tiles breed

      const n = fbm(noise, c * 0.04, r * 0.04, 5) * 3;
      const n2 = fbm(noise2, c * 0.09, r * 0.09, 3) * 2;

      if (minDistToSpine + n + n2 < widthAtT) {
        grid[r][c] = 3;
      }
    }
  }

  // Kleine eilandjes weg
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
      if (comp.length < 15) comp.forEach(([cr, cc]) => { grid[cr][cc] = 0; });
    }
  }

  // Kleine gaatjes dicht
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
      if (!touchesEdge && comp.length < 10) comp.forEach(([cr, cc]) => { grid[cr][cc] = 3; });
    }
  }

  return grid;
}

export function processElevation(raw: number[][]): number[][] {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const grid: number[][] = raw.map(r => [...r]);

  // Shallow water
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

  return grid;
}
